import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import './album.css'

const ALBUNS = [
  { estojo: '3d/diasantesdocaos.glb', cd: '3d/cddia.glb', lado: -1 },
  { estojo: '3d/caosdlx.glb', cd: '3d/cdcaos.glb', lado: 1 },
]

const VIRAR_FRENTE = Math.PI
const INCLINACAO_Y = -0.3
const INCLINACAO_X = 0.08

const REPOUSO_X = 0.25
const REPOUSO_LARGURA = 0.4

const DURACAO = 2.8
const ZOOM_ESTOJO = 1.25
const SAIDA_CD = 0.6
const ESCALA_ESTOJO_FIM = 0.5
const POSICAO_ESTOJO_FIM = -0.3
const TAMANHO_CD_FIM = 0.62
const VELOCIDADE_GIRO = 2.2
const INCLINACAO_CD = -0.3

const MOUSE_GIRO_Y = 0.45
const MOUSE_GIRO_X = 0.3
const MOUSE_SUAVIDADE = 5

const reduzirMovimento = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t
const suave = (t) => t * t * (3 - 2 * t)
const trecho = (p, ini, fim) => suave(clamp01((p - ini) / (fim - ini)))

function descartar(raiz) {
  raiz.traverse((obj) => {
    if (!obj.isMesh) return
    obj.geometry.dispose()
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v?.isTexture && v.dispose())
      m.dispose()
    })
  })
}

function Album() {
  const modeloRef = useRef(null)
  const palcoRef = useRef(null)

  useEffect(() => {
    const caixaModelo = modeloRef.current
    const palco = palcoRef.current
    if (!caixaModelo || !palco) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    palco.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap

    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(2, 3, 4)
    scene.add(key)

    const FOV = 30
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100)
    let distancia = 3
    let alturaVisivel = 1
    let larguraVisivel = 1

    const albuns = ALBUNS.map((cfg) => ({
      cfg,
      prog: 0,
      alvo: 0,
      giro: 0,
      estojo: null,
      cd: null,
      seg: { x: 0, y: 0 },
    }))
    let ativo = null
    let raf = 0
    let ultimo = 0

    const tela = { x: 0, y: 0, dentro: false }

    const render = () => renderer.render(scene, camera)

    const atualizarAlbum = (al, i, dt) => {
      const { estojo, cd } = al
      if (!estojo || !cd) return

      const sumir = ativo !== null && ativo !== i ? trecho(albuns[ativo].prog, 0, 0.3) : 0
      const prog = al.prog

      const a = trecho(prog, 0, 0.3)
      const b = trecho(prog, 0.3, 0.62)
      const c = trecho(prog, 0.55, 1)

      const escalaRepouso = Math.min(1, (REPOUSO_LARGURA * larguraVisivel) / estojo.largura)
      const escalaPerto = Math.min(ZOOM_ESTOJO, (0.85 * larguraVisivel) / estojo.largura)
      const escalaEstojoFim = Math.min(ESCALA_ESTOJO_FIM, (0.22 * larguraVisivel) / estojo.largura)
      const escalaEstojo =
        lerp(lerp(escalaRepouso, escalaPerto, a), escalaEstojoFim, c) * (1 - sumir)

      const repousoX = al.cfg.lado * REPOUSO_X * larguraVisivel
      const estojoX0 = lerp(repousoX, 0, a)
      const estojoX = lerp(estojoX0, POSICAO_ESTOJO_FIM * larguraVisivel, c)
      const estojoZ = 0.25 * a * (1 - c)

      estojo.raiz.visible = sumir < 0.999
      estojo.raiz.scale.setScalar(Math.max(escalaEstojo, 0.0001))
      estojo.raiz.position.set(estojoX, 0, estojoZ)
      estojo.raiz.rotation.set(
        lerp(INCLINACAO_X, 0, a) - al.seg.y * MOUSE_GIRO_X,
        lerp(VIRAR_FRENTE + INCLINACAO_Y, VIRAR_FRENTE, a) + al.seg.x * MOUSE_GIRO_Y,
        0
      )

      cd.raiz.visible = b > 0.001 && sumir < 0.999

      const diametroFim = Math.min(TAMANHO_CD_FIM * alturaVisivel, 0.5 * larguraVisivel)
      const escalaCdFim = diametroFim / cd.diametro
      const escalaCd = lerp(escalaPerto, escalaCdFim, c)

      const deslize = b * SAIDA_CD * estojo.largura * escalaPerto
      const cdX = lerp(estojoX0 + deslize, 0, c)
      const cdZ = lerp(0.25, 0.35, c)

      cd.raiz.scale.setScalar(escalaCd)
      cd.raiz.position.set(cdX, 0, cdZ)
      cd.inclinar.rotation.x = INCLINACAO_CD * c - al.seg.y * MOUSE_GIRO_X
      cd.inclinar.rotation.y = al.seg.x * MOUSE_GIRO_Y

      al.giro += dt * VELOCIDADE_GIRO * c
      cd.girar.rotation.z = al.giro
    }

    const atualizar = (dt) => {
      albuns.forEach((al, i) => atualizarAlbum(al, i, dt))
    }

    const quadro = (t) => {
      raf = 0
      const dt = ultimo ? Math.min((t - ultimo) / 1000, 0.05) : 0
      ultimo = t

      let continuar = false
      albuns.forEach((al) => {
        if (al.prog !== al.alvo) {
          const passo = dt / DURACAO
          al.prog =
            al.alvo > al.prog
              ? Math.min(al.alvo, al.prog + passo)
              : Math.max(al.alvo, al.prog - passo)
        }
        if (al.prog !== al.alvo || al.prog > 0.55) continuar = true
      })

      if (ativo !== null && albuns[ativo].prog === 0 && albuns[ativo].alvo === 0) ativo = null

      const animando = albuns.some((al) => al.prog !== al.alvo)
      const sobre =
        tela.dentro && !animando && !reduzirMovimento()
          ? acertou({ clientX: tela.x, clientY: tela.y })
          : -1
      const nx = (tela.x / window.innerWidth) * 2 - 1
      const ny = -((tela.y / window.innerHeight) * 2 - 1)
      const k = Math.min(1, dt * MOUSE_SUAVIDADE)

      albuns.forEach((al, i) => {
        const alvoX = sobre === i ? nx : 0
        const alvoY = sobre === i ? ny : 0
        al.seg.x += (alvoX - al.seg.x) * k
        al.seg.y += (alvoY - al.seg.y) * k
        if (Math.abs(alvoX - al.seg.x) > 0.001 || Math.abs(alvoY - al.seg.y) > 0.001) {
          continuar = true
        }
      })

      atualizar(dt)
      render()

      if (continuar) raf = requestAnimationFrame(quadro)
      else ultimo = 0
    }

    const pedirQuadro = () => {
      if (!raf) raf = requestAnimationFrame(quadro)
    }

    const ajustar = () => {
      const w = palco.clientWidth
      const h = palco.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h

      const caixa = Math.min(0.8 * Math.min(w, h), 576)
      const pxPorUnidade = caixa / 1.3
      alturaVisivel = h / pxPorUnidade
      larguraVisivel = alturaVisivel * camera.aspect
      distancia = alturaVisivel / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))

      camera.position.set(0, 0, distancia)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      atualizar(0)
      render()
    }

    let cancelado = false
    const carregador = new GLTFLoader()
    const base = import.meta.env.BASE_URL

    const prepararEstojo = (gltf) => {
      const raiz = new THREE.Group()
      const normal = new THREE.Group()
      raiz.add(normal)
      normal.add(gltf.scene)

      const caixa = new THREE.Box3().setFromObject(gltf.scene)
      const centro = caixa.getCenter(new THREE.Vector3())
      const tam = caixa.getSize(new THREE.Vector3())
      gltf.scene.position.sub(centro)

      const maior = Math.max(tam.x, tam.y, tam.z)
      normal.scale.setScalar(1 / maior)

      return {
        raiz,
        largura: tam.x / maior,
        altura: tam.y / maior,
      }
    }

    const prepararCd = (gltf, face) => {
      const raiz = new THREE.Group()
      const inclinar = new THREE.Group()
      const girar = new THREE.Group()
      const normal = new THREE.Group()
      raiz.add(inclinar)
      inclinar.add(girar)
      girar.add(normal)
      normal.add(gltf.scene)

      const caixa = new THREE.Box3().setFromObject(gltf.scene)
      const centro = caixa.getCenter(new THREE.Vector3())
      const tam = caixa.getSize(new THREE.Vector3())
      gltf.scene.position.sub(centro)

      const eixos = [
        { v: new THREE.Vector3(1, 0, 0), t: tam.x },
        { v: new THREE.Vector3(0, 1, 0), t: tam.y },
        { v: new THREE.Vector3(0, 0, 1), t: tam.z },
      ].sort((p, q) => p.t - q.t)
      const fino = eixos[0].v
      const diametroOriginal = Math.max(eixos[1].t, eixos[2].t)

      normal.quaternion.setFromUnitVectors(fino, new THREE.Vector3(0, 0, 1))

      const diametro = 0.92 * Math.min(face.largura, face.altura)
      normal.scale.setScalar(diametro / diametroOriginal)

      return { raiz, inclinar, girar, diametro }
    }

    albuns.forEach(async (al) => {
      try {
        const [gEstojo, gCd] = await Promise.all([
          carregador.loadAsync(`${base}${al.cfg.estojo}`),
          carregador.loadAsync(`${base}${al.cfg.cd}`),
        ])
        if (cancelado) return

        al.estojo = prepararEstojo(gEstojo)
        al.cd = prepararCd(gCd, al.estojo)
        al.cd.raiz.visible = false
        scene.add(al.estojo.raiz)
        scene.add(al.cd.raiz)
        ajustar()
      } catch (erro) {
        if (!cancelado) console.error(`Erro ao carregar o álbum ${al.cfg.estojo}:`, erro)
      }
    })

    const ro = new ResizeObserver(ajustar)
    ro.observe(palco)
    ajustar()

    const raycaster = new THREE.Raycaster()
    const ponteiro = new THREE.Vector2()

    const acertou = (ev) => {
      if (parseFloat(getComputedStyle(caixaModelo).opacity) < 0.8) return -1

      const r = palco.getBoundingClientRect()
      const x = ev.clientX - r.left
      const y = ev.clientY - r.top
      if (x < 0 || y < 0 || x > r.width || y > r.height) return -1

      ponteiro.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1)
      camera.updateMatrixWorld()
      raycaster.setFromCamera(ponteiro, camera)

      let melhor = -1
      let menor = Infinity
      albuns.forEach((al, i) => {
        if (!al.estojo || !al.cd || !al.estojo.raiz.visible) return
        if (ativo !== null && ativo !== i) return

        const alvos = [al.estojo.raiz]
        if (al.cd.raiz.visible) alvos.push(al.cd.raiz)
        const hits = raycaster.intersectObjects(alvos, true)
        if (hits.length && hits[0].distance < menor) {
          menor = hits[0].distance
          melhor = i
        }
      })
      return melhor
    }

    const aoClicar = (ev) => {
      const i = acertou(ev)
      if (i < 0) return

      const al = albuns[i]
      al.alvo = al.alvo === 0 ? 1 : 0
      if (al.alvo === 1) ativo = i

      if (reduzirMovimento()) {
        al.prog = al.alvo
        if (al.alvo === 0) ativo = null
        atualizar(0)
        render()
        return
      }
      pedirQuadro()
    }

    const aoMover = (ev) => {
      document.body.style.cursor = acertou(ev) >= 0 ? 'pointer' : ''

      tela.x = ev.clientX
      tela.y = ev.clientY
      tela.dentro = true
      pedirQuadro()
    }

    const aoSair = () => {
      tela.dentro = false
      pedirQuadro()
    }

    window.addEventListener('click', aoClicar)
    window.addEventListener('pointermove', aoMover)
    document.documentElement.addEventListener('mouseleave', aoSair)

    return () => {
      cancelado = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('click', aoClicar)
      window.removeEventListener('pointermove', aoMover)
      document.documentElement.removeEventListener('mouseleave', aoSair)
      document.body.style.cursor = ''
      descartar(scene)
      envMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <section className={`album ${reduzirMovimento() ? '' : 'album-sobreposto'}`}>
      <h2 className="album-titulo">Álbum</h2>
      <div className="album-modelo" ref={modeloRef} aria-hidden="true">
        <div className="album-palco" ref={palcoRef} />
      </div>
    </section>
  )
}

export default Album