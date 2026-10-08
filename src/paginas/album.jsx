import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import './album.css'

const ALBUNS = [
  { estojo: '3d/diasantesdocaos.glb', cd: '3d/cddia.glb', lado: -1, gira: false, nome: 'DIAS ANTES DO CAOS' },
  { estojo: '3d/ptqfa.glb', cd: '3d/cdptqfa.glb', lado: 0, gira: false, nome: 'PTQFA' },
  { estojo: '3d/caosdlx.glb', cd: '3d/cdcaos.glb', lado: 1, gira: true, nome: 'CAOS DLX' },
]

const VIRAR_FRENTE = Math.PI
const INCLINACAO_Y = -0.3
const INCLINACAO_X = 0.08

const REPOUSO_X = 0.3
const REPOUSO_LARGURA = 0.28

const DURACAO = 2.8
const DURACAO_VIRAR = 0.9
const ZOOM_ESTOJO = 1.25
const SAIDA_CD = 0.6
const POSICAO_ESTOJO_FIM = -0.2
const POSICAO_CD_FIM = 0.14
const SAIDA_LATERAL = 0.65

const TOTAL_RASTRO = 10
const DISTANCIA_RASTRO = 130
const DURACAO_RASTRO = 1600
const MAXIMO_RASTRO = 10
const TAMANHO_CD_FIM = 0.62
const VELOCIDADE_GIRO = 2.2
const INCLINACAO_CD = -0.3

const MOUSE_GIRO_Y = 0.45
const MOUSE_GIRO_X = 0.3
const MOUSE_SUAVIDADE = 5

const EXPOSICAO = 0.65
const EXPOSICAO_ABERTO = 0.42
const LUZ_AMBIENTE = 0.55
const LUZ_PRINCIPAL = 0.8

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

async function carregarRecortada(src) {
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)

    let x0 = width, y0 = height, x1 = -1, y1 = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    if (x1 < 0) return { url: src, proporcao: width / height }

    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    const escala = Math.min(1, 640 / Math.max(w, h))
    const out = document.createElement('canvas')
    out.width = Math.round(w * escala)
    out.height = Math.round(h * escala)
    out.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, out.width, out.height)
    const blob = await new Promise((r) => out.toBlob(r, 'image/webp', 0.9))
    return { url: URL.createObjectURL(blob), proporcao: w / h, blob: true }
  } catch {
    return { url: src, proporcao: 16 / 9 }
  }
}

function Album() {
  const modeloRef = useRef(null)
  const palcoRef = useRef(null)
  const rastroRef = useRef(null)
  const rastroLigadoRef = useRef(true)

  useEffect(() => {
    const caixaModelo = modeloRef.current
    const palco = palcoRef.current
    if (!caixaModelo || !palco) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = EXPOSICAO
    palco.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap
    scene.environmentIntensity = LUZ_AMBIENTE

    const key = new THREE.DirectionalLight(0xffffff, LUZ_PRINCIPAL)
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
      virar: 0,
      vira: 0,
    }))
    let ativo = null
    let raf = 0
    let ultimo = 0

    const tela = { x: 0, y: 0, dentro: false }
    const pontoDica = new THREE.Vector3()
    const textoDica = window.matchMedia('(hover: none)').matches ? 'toque' : 'clique'

    albuns.forEach((al) => {
      const el = document.createElement('div')
      el.className = 'album-dica'
      el.setAttribute('aria-hidden', 'true')
      const nome = document.createElement('span')
      nome.className = 'album-dica-nome'
      nome.textContent = al.cfg.nome
      const linha = document.createElement('span')
      linha.className = 'album-dica-linha'
      linha.innerHTML = `<span class="album-dica-pulso"></span><span class="album-dica-texto">${textoDica}</span>`
      el.append(nome, linha)
      palco.appendChild(el)
      al.dica = el
    })

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
      const escalaEstojo = lerp(escalaRepouso, escalaPerto, a)

      let direcao = Math.sign(al.cfg.lado)
      if (direcao === 0) direcao = ativo !== null && albuns[ativo].cfg.lado < 0 ? 1 : -1
      const saidaLateral = direcao * sumir * SAIDA_LATERAL * larguraVisivel

      const repousoX = al.cfg.lado * REPOUSO_X * larguraVisivel
      const estojoX0 = lerp(repousoX, 0, a)
      const estojoX = lerp(estojoX0, POSICAO_ESTOJO_FIM * larguraVisivel, c)
      const estojoZ = 0.25 * a

      estojo.raiz.visible = sumir < 0.999
      estojo.raiz.scale.setScalar(Math.max(escalaEstojo, 0.0001))
      estojo.raiz.position.set(estojoX + saidaLateral, 0, estojoZ)
      estojo.raiz.rotation.set(
        lerp(INCLINACAO_X, 0, a) - al.seg.y * MOUSE_GIRO_X,
        lerp(VIRAR_FRENTE + INCLINACAO_Y, VIRAR_FRENTE, a) + al.seg.x * MOUSE_GIRO_Y + (al.cfg.gira ? Math.PI * c + Math.PI * suave(al.vira) : 0),
        0
      )

      cd.raiz.visible = b > 0.001 && sumir < 0.999

      const diametroFim = Math.min(TAMANHO_CD_FIM * alturaVisivel, 0.5 * larguraVisivel)
      const escalaCdFim = diametroFim / cd.diametro
      const escalaCd = lerp(escalaPerto, escalaCdFim, c)

      const deslize = b * SAIDA_CD * estojo.largura * escalaPerto
      const cdX = lerp(estojoX0 + deslize, POSICAO_CD_FIM * larguraVisivel, c)
      const cdZ = lerp(0.25, 0.35, c)

      cd.raiz.scale.setScalar(escalaCd)
      cd.raiz.position.set(cdX, 0, cdZ)
      cd.inclinar.rotation.x = INCLINACAO_CD * c - al.seg.y * MOUSE_GIRO_X
      cd.inclinar.rotation.y = al.seg.x * MOUSE_GIRO_Y

      al.giro += dt * VELOCIDADE_GIRO * c
      cd.girar.rotation.z = al.giro

      if (al.dica) {
        camera.updateMatrixWorld()
        pontoDica
          .set(estojoX + saidaLateral, -(estojo.altura * escalaEstojo) / 2, estojoZ)
          .project(camera)
        const px = (pontoDica.x * 0.5 + 0.5) * palco.clientWidth
        const py = (-pontoDica.y * 0.5 + 0.5) * palco.clientHeight
        al.dica.style.transform = `translate(calc(${px}px - 50%), ${py + 18}px)`
        al.dica.style.opacity = ativo === null ? String(1 - a) : '0'
      }
    }

    const atualizar = (dt) => {
      albuns.forEach((al, i) => atualizarAlbum(al, i, dt))
      const abertura = albuns.reduce((m, al) => Math.max(m, al.prog), 0)
      renderer.toneMappingExposure = lerp(EXPOSICAO, EXPOSICAO_ABERTO, suave(abertura))
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
        if (al.vira !== al.virar) {
          const passoVirar = dt / DURACAO_VIRAR
          al.vira =
            al.virar > al.vira
              ? Math.min(al.virar, al.vira + passoVirar)
              : Math.max(al.virar, al.vira - passoVirar)
        }
        if (al.prog !== al.alvo || al.vira !== al.virar || al.prog > 0.55) continuar = true
      })

      if (ativo !== null && albuns[ativo].prog === 0 && albuns[ativo].alvo === 0) ativo = null
      rastroLigadoRef.current = ativo === null

      const animando = albuns.some((al) => al.prog !== al.alvo || al.vira !== al.virar)
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
        if (al.dica) al.dica.classList.toggle('album-dica-ativa', sobre === i)
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

    let tocado = 'estojo'
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

        const hitEstojo = raycaster.intersectObject(al.estojo.raiz, true)[0]
        const hitCd = al.cd.raiz.visible ? raycaster.intersectObject(al.cd.raiz, true)[0] : undefined
        const dEstojo = hitEstojo ? hitEstojo.distance : Infinity
        const dCd = hitCd ? hitCd.distance : Infinity
        const d = Math.min(dEstojo, dCd)
        if (d < menor) {
          menor = d
          melhor = i
          tocado = dCd < dEstojo ? 'cd' : 'estojo'
        }
      })
      return melhor
    }

    const aoClicar = (ev) => {
      const i = acertou(ev)
      if (i < 0) return

      const al = albuns[i]

      if (al.cfg.gira && tocado === 'estojo' && al.alvo === 1 && al.prog === 1) {
        al.virar = al.virar === 0 ? 1 : 0
        if (reduzirMovimento()) al.vira = al.virar
        pedirQuadro()
        return
      }

      al.alvo = al.alvo === 0 ? 1 : 0
      if (al.alvo === 1) ativo = i
      if (ativo !== null) rastroLigadoRef.current = false
      if (al.alvo === 0) al.virar = 0

      if (reduzirMovimento()) {
        al.prog = al.alvo
        if (al.alvo === 0) {
          ativo = null
          al.vira = 0
        }
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
      albuns.forEach((al) => al.dica?.remove())
    }
  }, [])

  useEffect(() => {
    const camada = rastroRef.current
    const caixaModelo = modeloRef.current
    if (!camada || !caixaModelo || reduzirMovimento()) return

    const base = import.meta.env.BASE_URL
    let cancelado = false
    let imagens = []
    let indice = 0
    let ultimoX = null
    let ultimoY = null

    Promise.all(
      Array.from({ length: TOTAL_RASTRO }, (_, i) =>
        carregarRecortada(`${base}alee/alee${i + 1}.png`)
      )
    ).then((lista) => {
      if (cancelado) lista.forEach((im) => im.blob && URL.revokeObjectURL(im.url))
      else imagens = lista
    })

    const criar = (x, y) => {
      const im = imagens[indice]
      indice = (indice + 1) % imagens.length

      const el = document.createElement('img')
      el.className = 'album-rastro-img'
      el.src = im.url
      el.alt = ''
      el.draggable = false
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.width = `calc(var(--album-rastro-lado) * ${Math.min(1, im.proporcao)})`
      el.style.aspectRatio = `${im.proporcao}`
      camada.appendChild(el)

      while (camada.children.length > MAXIMO_RASTRO) camada.firstChild.remove()

      const giro = (Math.random() - 0.5) * 12
      const pos = `translate(-50%, -50%)`
      const anim = el.animate(
        [
          { opacity: 0, transform: `${pos} scale(0.7) rotate(${giro}deg)` },
          { opacity: 1, transform: `${pos} scale(1) rotate(${giro}deg)`, offset: 0.18 },
          { opacity: 1, transform: `${pos} scale(1) rotate(${giro}deg)`, offset: 0.6 },
          { opacity: 0, transform: `${pos} scale(0.92) rotate(${giro}deg)` },
        ],
        { duration: DURACAO_RASTRO, easing: 'ease-out' }
      )
      anim.onfinish = () => el.remove()
    }

    const aoMover = (ev) => {
      if (ev.pointerType && ev.pointerType !== 'mouse') return
      if (!imagens.length) return
      if (!rastroLigadoRef.current) {
        ultimoX = null
        return
      }
      if (parseFloat(getComputedStyle(caixaModelo).opacity) < 0.8) {
        ultimoX = null
        return
      }
      const r = camada.getBoundingClientRect()
      const x = ev.clientX - r.left
      const y = ev.clientY - r.top
      if (x < 0 || y < 0 || x > r.width || y > r.height) {
        ultimoX = null
        return
      }
      if (ultimoX === null) {
        ultimoX = x
        ultimoY = y
        return
      }
      if (Math.hypot(x - ultimoX, y - ultimoY) < DISTANCIA_RASTRO) return
      ultimoX = x
      ultimoY = y
      criar(x, y)
    }

    window.addEventListener('pointermove', aoMover)

    return () => {
      cancelado = true
      window.removeEventListener('pointermove', aoMover)
      camada.replaceChildren()
      imagens.forEach((im) => im.blob && URL.revokeObjectURL(im.url))
    }
  }, [])

  return (
    <section className={`album ${reduzirMovimento() ? '' : 'album-sobreposto'}`}>
      <div className="album-rastro" ref={rastroRef} aria-hidden="true" />
      <h2 className="album-titulo">PURO CAOS!!</h2>
      <div className="album-modelo" ref={modeloRef} aria-hidden="true">
        <div className="album-palco" ref={palcoRef} />
      </div>
    </section>
  )
}

export default Album