import { useEffect, useRef, useState } from 'react'
import './jogo.css'

const BASE = import.meta.env.BASE_URL

const CHAO = 0.1435
const PONTOS_TOASTY = 500
const INTERVALO_TOASTY = 1000
const SALTO_MIN = 0.5
const SALTO_MAX = 0.75
const TILES_GRAMA = 4
const ALTURA_SPRITE = 0.26
const RAIO_ACERTO = 0.4
const PONTOS = 100
const MAX_SIMULTANEOS = 2
const MIRA = { x: 0.64, y: 0.52 }
const CENTRO_HIT = { x: 0.575, y: 0.47 }

const alturaChao = (W, H) => H - CHAO * Math.max(H, (W * 9) / 16)

const img = (nome) => `${BASE}jogohu/${nome}.png`

function Jogo() {
  const [jogando, setJogando] = useState(false)
  const [pontos, setPontos] = useState(0)
  const [perdidos, setPerdidos] = useState(0)
  const [tiros, setTiros] = useState(0)
  const [alvos, setAlvos] = useState([])
  const [hits, setHits] = useState([])
  const [toasty, setToasty] = useState(false)

  const dados = useRef(new Map())
  const proximoId = useRef(0)
  const espera = useRef(0.5)
  const mouse = useRef({ x: -9999, y: -9999 })
  const maoRef = useRef(null)
  const maoImgRef = useRef(null)
  const alvosRef = useRef(null)

  const tamanhoMao = () => {
    const w = Math.max(window.innerWidth * 0.55, window.innerHeight * 0.5)
    return { w, h: (w * 9) / 16 }
  }

  const moverMao = (x, y) => {
    mouse.current = { x, y }
    const el = maoRef.current
    if (!el) return
    const { w, h } = tamanhoMao()
    el.style.transform = `translate(${x - MIRA.x * w}px, ${y - MIRA.y * h}px)`
    el.style.visibility = 'visible'
  }

  const aoMover = (e) => moverMao(e.clientX, e.clientY)

  const atirar = (e) => {
    moverMao(e.clientX, e.clientY)

    if (!jogando) {
      setJogando(true)
      return
    }

    maoImgRef.current?.animate(
      [
        { transform: 'rotate(0deg) translateY(0)' },
        { transform: 'rotate(-7deg) translateY(-1.5vh)' },
        { transform: 'rotate(0deg) translateY(0)' },
      ],
      { duration: 180, easing: 'ease-out' },
    )

    setTiros((t) => t + 1)

    const H = window.innerHeight
    const chao = alturaChao(window.innerWidth, H)
    const raio = H * ALTURA_SPRITE * RAIO_ACERTO
    const { x: mx, y: my } = mouse.current

    let acertado = null
    for (const [id, a] of dados.current) {
      if (a.y < chao && Math.hypot(a.x - mx, a.y - my) <= raio) acertado = id
    }

    if (acertado !== null) {
      const a = dados.current.get(acertado)
      dados.current.delete(acertado)
      setAlvos((l) => l.filter((o) => o.id !== acertado))
      setPontos((p) => p + PONTOS)
      const novo = pontos + PONTOS
      const primeiro = pontos < PONTOS_TOASTY && novo >= PONTOS_TOASTY
      const recorrente = Math.floor(novo / INTERVALO_TOASTY) > Math.floor(pontos / INTERVALO_TOASTY)
      if (primeiro || recorrente) {
        setToasty(true)
        new Audio(`${BASE}jogohu/toasty.mp3`).play().catch(() => {})
      }
      const idHit = proximoId.current++
      setHits((l) => [...l, { id: idHit, x: a.x, y: a.y }])
    }
  }

  useEffect(() => {
    if (!jogando) return
    let raf
    let ultimo = performance.now()

    const lancar = (W, H) => {
      const id = proximoId.current++
      const g = H * 1.8
      const subida = H * (SALTO_MIN + Math.random() * (SALTO_MAX - SALTO_MIN))
      const th = H * ALTURA_SPRITE
      dados.current.set(id, {
        x: W * (0.15 + Math.random() * 0.7),
        y: alturaChao(W, H) + th * 0.5,
        vx: (Math.random() - 0.5) * W * 0.4,
        vy: -Math.sqrt(2 * g * subida),
        rot: Math.random() * 360,
        vr: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360),
        el: null,
      })
      setAlvos((l) => [...l, { id }])
    }

    const loop = (agora) => {
      const dt = Math.min((agora - ultimo) / 1000, 0.05)
      ultimo = agora
      const W = window.innerWidth
      const H = window.innerHeight
      const g = H * 1.8
      const th = H * ALTURA_SPRITE
      const tw = th * 16 / 9
      const chao = alturaChao(W, H)

      if (alvosRef.current) alvosRef.current.style.clipPath = `inset(0 0 ${H - chao}px 0)`

      espera.current -= dt
      if (espera.current <= 0 && dados.current.size < MAX_SIMULTANEOS) {
        lancar(W, H)
        espera.current = 0.5 + Math.random() * 1.0
      }

      for (const [id, a] of dados.current) {
        a.vy += g * dt
        a.x += a.vx * dt
        a.y += a.vy * dt
        a.rot += a.vr * dt
        if (a.x < 0 || a.x > W) a.vx *= -1

        if (a.vy > 0 && a.y > chao + th * 0.5) {
          dados.current.delete(id)
          setAlvos((l) => l.filter((o) => o.id !== id))
          setPerdidos((p) => p + 1)
          continue
        }

        if (a.el) {
          a.el.style.width = `${tw}px`
          a.el.style.height = `${th}px`
          a.el.style.transform = `translate(${a.x - tw / 2}px, ${a.y - th / 2}px) rotate(${a.rot}deg)`
          a.el.style.visibility = 'visible'
        }
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [jogando])

  const reiniciar = (e) => {
    e.stopPropagation()
    dados.current.clear()
    setAlvos([])
    setHits([])
    setPontos(0)
    setPerdidos(0)
    setTiros(0)
    setToasty(false)
    espera.current = 0.5
  }

  const hh = typeof window !== 'undefined' ? window.innerHeight * 0.22 : 200
  const hw = hh * 16 / 9

  return (
    <main className="jogo" onPointerMove={aoMover} onPointerDown={atirar}>
      <img className="jogo__camada jogo__ceu" src={img('ceu')} alt="" aria-hidden="true" draggable="false" />
      <img className="jogo__camada jogo__terra" src={img('terra')} alt="" aria-hidden="true" draggable="false" />
      <img className="jogo__camada jogo__arvore" src={img('arvore')} alt="" aria-hidden="true" draggable="false" />

      <div className="jogo__alvos" ref={alvosRef}>
      {alvos.map(({ id }) => (
        <img
          key={id}
          ref={(el) => {
            const a = dados.current.get(id)
            if (a) a.el = el
          }}
          className="jogo__sprite"
          src={img('sprite')}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      ))}
      </div>

      <div className="jogo__grama" aria-hidden="true">
        {Array.from({ length: TILES_GRAMA }, (_, i) => (
          <img
            key={i}
            className={i % 2 ? 'jogo__grama-tile jogo__grama-tile--espelho' : 'jogo__grama-tile'}
            src={img('grama')}
            alt=""
            draggable="false"
          />
        ))}
      </div>

      {hits.map((h) => (
        <img
          key={h.id}
          className="jogo__hit"
          src={img('hit')}
          alt=""
          aria-hidden="true"
          draggable="false"
          style={{
            width: hw,
            height: hh,
            left: h.x - CENTRO_HIT.x * hw,
            top: h.y - CENTRO_HIT.y * hh,
          }}
          onAnimationEnd={() => setHits((l) => l.filter((o) => o.id !== h.id))}
        />
      ))}

      {toasty && (
        <img
          className="jogo__toasty"
          src={img('toasty')}
          alt=""
          aria-hidden="true"
          draggable="false"
          onAnimationEnd={() => setToasty(false)}
        />
      )}

      <div className="jogo__hud">
        <span>Pontos: {pontos}</span>
        <span>Perdidos: {perdidos}</span>
        <span>Tiros: {tiros}</span>
        <button type="button" onPointerDown={reiniciar}>Reiniciar</button>
        <a href="#/" onPointerDown={(e) => e.stopPropagation()}>Voltar</a>
      </div>

      {!jogando && (
        <div className="jogo__inicio">
          <p>Clique para começar</p>
        </div>
      )}

      <div className="jogo__mao" ref={maoRef}>
        <img ref={maoImgRef} src={img('mao')} alt="" aria-hidden="true" draggable="false" />
      </div>
    </main>
  )
}

export default Jogo