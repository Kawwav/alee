import { useEffect, useRef, useState } from 'react'
import './footer.css'

const BASE = import.meta.env.BASE_URL
const ENTRADA_FIM = 0.85
const ENTRADA_DISTANCIA = 1.1
const MOUSE_ALEES_X = 32
const MOUSE_ALEES_Y = 14
const MOUSE_FUNDO = 18
const SCROLL_FUNDO = 0.04
const SUAVIDADE = 0.08

const suavizar = (t) => 1 - Math.pow(1 - t, 3)

function Footer() {
  const secao = useRef(null)
  const fundo = useRef(null)
  const paralaxe = useRef(null)
  const [original, setOriginal] = useState(false)

  useEffect(() => {
    const el = secao.current
    const cortina = el?.parentElement
    if (!cortina) return

    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduzir) return

    const estado = { p: 0, alvoX: 0, alvoY: 0, x: 0, y: 0, raf: 0 }

    const desenhar = () => {
      estado.raf = 0
      estado.x += (estado.alvoX - estado.x) * SUAVIDADE
      estado.y += (estado.alvoY - estado.y) * SUAVIDADE

      const largura = window.innerWidth
      const altura = window.innerHeight
      const entrada = 1 - suavizar(Math.min(estado.p / ENTRADA_FIM, 1))

      if (paralaxe.current) {
        const x = entrada * largura * ENTRADA_DISTANCIA + estado.x * MOUSE_ALEES_X
        const y = estado.y * MOUSE_ALEES_Y
        paralaxe.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }

      if (fundo.current) {
        const x = -estado.x * MOUSE_FUNDO
        const y = -estado.y * MOUSE_FUNDO - (1 - estado.p) * altura * SCROLL_FUNDO
        fundo.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.12)`
      }

      const andando =
        Math.abs(estado.alvoX - estado.x) > 0.001 ||
        Math.abs(estado.alvoY - estado.y) > 0.001
      if (andando) estado.raf = requestAnimationFrame(desenhar)
    }

    const agendar = () => {
      if (!estado.raf) estado.raf = requestAnimationFrame(desenhar)
    }

    const aoRolar = () => {
      const altura = window.innerHeight
      const revelado = 2 * altura - cortina.getBoundingClientRect().bottom
      estado.p = Math.min(Math.max(revelado / altura, 0), 1)
      agendar()
    }

    const aoMoverMouse = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      estado.alvoX = (e.clientX / window.innerWidth - 0.5) * 2
      estado.alvoY = (e.clientY / window.innerHeight - 0.5) * 2
      agendar()
    }

    const aoSairMouse = () => {
      estado.alvoX = 0
      estado.alvoY = 0
      agendar()
    }

    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    window.addEventListener('resize', aoRolar)
    window.addEventListener('pointermove', aoMoverMouse, { passive: true })
    document.documentElement.addEventListener('mouseleave', aoSairMouse)
    return () => {
      cancelAnimationFrame(estado.raf)
      window.removeEventListener('scroll', aoRolar)
      window.removeEventListener('resize', aoRolar)
      window.removeEventListener('pointermove', aoMoverMouse)
      document.documentElement.removeEventListener('mouseleave', aoSairMouse)
    }
  }, [])

  return (
    <footer id="footer" ref={secao} className="footer">
      <img
        className="footer__fundo"
        ref={fundo}
        src={`${BASE}footer/fundo.webp`}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div className="footer__paralaxe" ref={paralaxe}>
        <img
          className={original ? 'footer__alees' : 'footer__alees footer__alees--ativa'}
          src={`${BASE}footer/aleess.webp`}
          alt="Alee"
          draggable="false"
        />
        <img
          className={original ? 'footer__alees footer__alees--ativa' : 'footer__alees'}
          src={`${BASE}footer/anjoferido.png`}
          alt="Anjo ferido"
          draggable="false"
        />
      </div>
      <div className="footer__acoes">
        <a className="footer__botao" href="#/jogo">
          The game
        </a>
        <button
          type="button"
          className="footer__botao"
          onClick={() => setOriginal((atual) => !atual)}
          aria-pressed={original}
        >
          {original ? 'Voltar' : 'Ver original'}
        </button>
      </div>
    </footer>
  )
}

export default Footer