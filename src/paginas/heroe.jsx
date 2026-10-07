import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './heroe.css'

gsap.registerPlugin(ScrollTrigger)
ScrollTrigger.config({ ignoreMobileResize: true })

const TOTAL = 9 
const CENTRO = 'espadajesus'
const INTERCALADAS = ['cruzpreta', 'espada', 'cruzvermelha', 'espada'] 
const ESCALA = { espadajesus: 1.35, espada: 1.05, cruzpreta: 0.85, cruzvermelha: 0.75 }
const PICO_DESFOQUE = 0.75 
const DURACAO_VIDEO = 4000
const ESCRITA_ATRASO = 1.6
const ESCRITA_DURACAO = 2.6
const FRASE_PAUSA = 0.3 
const FRASE_DURACAO = 3
const LIMITE_SEGURANCA = 8000
const ZOOM_INICIO = 0.3 
const SAIDA_PASSO = 0.06 
const SAIDA_DURACAO = 0.4 
const DISTANCIA_SCROLL = 400
const MODELO_INICIO = 0.88 // progresso do scroll em que o modelo 3D é disparado
const MODELO_ATRASO = 0.35 // atraso (s) depois do gatilho
const MODELO_DURACAO = 2.8 // duração (s) da entrada, bem suave

const reduzirMovimento = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Heroe() {
  const [fase, setFase] = useState(() => (reduzirMovimento() ? 'pronto' : 'video'))
  const timerVideo = useRef(null)
  const timerSeguranca = useRef(null)
  const tituloRef = useRef(null)
  const fraseRef = useRef(null)
  const trilhoRef = useRef(null)
  const secaoRef = useRef(null)
  const cenaRef = useRef(null)
  const arcoRef = useRef(null)
  const palcoRef = useRef(null)
  const portalRef = useRef(null)
  const [liberado, setLiberado] = useState(() => reduzirMovimento())

  const sair = () => setFase((atual) => (atual === 'video' ? 'saindo' : atual))

  useEffect(() => {
    if (fase !== 'video') return
    timerSeguranca.current = setTimeout(sair, LIMITE_SEGURANCA)
    return () => {
      clearTimeout(timerVideo.current)
      clearTimeout(timerSeguranca.current)
    }
  }, [fase])

  const intro = fase === 'video'
  useEffect(() => {
    if (intro || reduzirMovimento()) return
    const ctx = gsap.context(() => {
      gsap
        .timeline({ onComplete: () => setLiberado(true) })
        .to(tituloRef.current, {
          '--p': 1,
          duration: ESCRITA_DURACAO,
          delay: ESCRITA_ATRASO,
          ease: 'power1.inOut',
        })
        .to(
          fraseRef.current,
          {
            '--p': 1,
            duration: FRASE_DURACAO,
            ease: 'power1.inOut',
          },
          `>+${FRASE_PAUSA}`
        )
    })
    return () => ctx.revert()
  }, [intro])

  useEffect(() => {
    if (liberado) return
    window.scrollTo(0, 0)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [liberado])

  useEffect(() => {
    if (!liberado || reduzirMovimento()) return
    const altura = () => window.innerHeight

    const ctx = gsap.context(() => {
      const definirOrigem = () =>
        gsap.set(cenaRef.current, {
          transformOrigin: `${tituloRef.current.offsetLeft}px ${tituloRef.current.offsetTop}px`,
        })
      definirOrigem()

      let entradaModelo = null
      let modeloVisivel = false

      const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: trilhoRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.8,
            invalidateOnRefresh: true,
            onRefreshInit: definirOrigem,
            onUpdate: (self) => {
              secaoRef.current?.classList.toggle('zoomando', self.progress > ZOOM_INICIO - 0.03)

              // O modelo 3D usa animação por tempo (não presa ao scroll) para ser super suave
              const deveEntrar = self.progress >= MODELO_INICIO
              if (entradaModelo && deveEntrar !== modeloVisivel) {
                modeloVisivel = deveEntrar
                if (deveEntrar) entradaModelo.timeScale(1).play()
                else entradaModelo.timeScale(2).reverse()
              }
            },
          },
        })

        .to(palcoRef.current, { y: () => altura() * 0.7, duration: 0.5, ease: 'power1.in' }, 0)
        .to(palcoRef.current, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 0.3)

        .to(fraseRef.current, { y: () => altura() * 0.5, duration: 0.5, ease: 'power1.in' }, 0)
        .to(fraseRef.current, { opacity: 0, duration: 0.25, ease: 'power1.in' }, 0.1)

        .to(
          cenaRef.current,
          {
            scale: () =>
              Math.max(30, (window.innerWidth * 4) / tituloRef.current.offsetWidth),
            duration: 0.55, // termina em 0.85
            ease: 'power3.in',
          },
          ZOOM_INICIO
        )

        // "Alee" some no final do zoom (0.75 → 0.85)
        .to(cenaRef.current, { opacity: 0, duration: 0.1, ease: 'power1.in' }, 0.75)

      // Só depois que o zoom completa e o Alee sumiu (0.85) o Álbum aparece
      const tituloAlbum = document.querySelector('.album-titulo')
      if (tituloAlbum) {
        tl.fromTo(
          tituloAlbum,
          { y: () => -altura() * 0.5, opacity: 0, filter: 'blur(8px)' },
          {
            y: 0,
            opacity: 1,
            filter: 'blur(0px)',
            duration: 0.15,
            ease: 'power3.out',
          },
          0.85
        )
      }

      // O modelo 3D entra da direita com delay e uma easing muito longa e suave.
      // Roda por tempo (não por scroll): toca ao passar de MODELO_INICIO e reverte ao voltar.
      const modeloAlbum = document.querySelector('.album-modelo')
      if (modeloAlbum) {
        entradaModelo = gsap
          .timeline({ paused: true })
          .fromTo(
            modeloAlbum,
            { x: () => window.innerWidth * 0.6 },
            { x: 0, duration: MODELO_DURACAO, ease: 'expo.out' },
            MODELO_ATRASO
          )
          .fromTo(
            modeloAlbum,
            { opacity: 0 },
            { opacity: 1, duration: MODELO_DURACAO * 0.6, ease: 'sine.inOut' },
            MODELO_ATRASO
          )
      }

      // garante que a timeline sempre dura 1.0 (mesmo sem os elementos do Álbum)
      tl.set({}, {}, 1)

      arcoRef.current.querySelectorAll('.saida').forEach((el) => {
        const passo = Number(el.dataset.passo)
        tl.fromTo(
          el,
          { y: 0, opacity: 1, filter: 'blur(0px)' },
          {
            y: () => -altura() * 0.7,
            opacity: 0,
            filter: 'blur(24px)',
            duration: SAIDA_DURACAO,
            ease: 'power2.in',
          },
          passo * SAIDA_PASSO
        )
      })
    }, trilhoRef)

    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [liberado])

  const aoComecarVideo = () => {
    if (timerVideo.current) return
    clearTimeout(timerSeguranca.current)
    timerVideo.current = setTimeout(sair, DURACAO_VIDEO)
  }

  return (
    <div
      className="heroe-trilho"
      ref={trilhoRef}
      style={reduzirMovimento() ? undefined : { height: `${100 + DISTANCIA_SCROLL}svh` }}
    >
    <section className={`secao ${fase === 'video' ? 'tocando' : ''}`} ref={secaoRef}>
      <div className="portal" ref={portalRef} aria-hidden="true" />

      <div className="cena" ref={cenaRef}>
      <div className="arco" ref={arcoRef}>
        {Array.from({ length: TOTAL }, (_, i) => {
          const meio = (TOTAL - 1) / 2
          const passo = Math.abs(i - meio)
          const distancia = passo / meio
          const desfoque =
            distancia <= PICO_DESFOQUE
              ? distancia / PICO_DESFOQUE
              : (1 - distancia) / (1 - PICO_DESFOQUE)
          const nome =
            passo === 0 ? CENTRO : INTERCALADAS[(passo - 1) % INTERCALADAS.length]

          return (
            <span
              key={i}
              className="peca"
              style={{
                '--distancia': distancia,
                '--desfoque': desfoque,
                '--passo': passo,
                '--escala': ESCALA[nome],
              }}
            >
              <span className="saida" data-passo={passo}>
                <span
                  className="item"
                  style={{ '--angulo': `${-90 + (i * 180) / (TOTAL - 1)}deg` }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}herocirculo/${nome}.png`}
                    alt=""
                    aria-hidden="true"
                    draggable="false"
                  />
                </span>
              </span>
            </span>
          )
        })}
      </div>

      <div className="imagem-palco" ref={palcoRef}>
        <div className="imagem">
          <img className="foto" src={`${import.meta.env.BASE_URL}heroe/alee.png`} alt="Alee" />
        </div>
      </div>

      <h1 className="titulo" ref={tituloRef}>
        Alee
      </h1>


      <p className="frase" ref={fraseRef}>
        "Faço isso só com o passar do tempo"
      </p>
      </div>

      {fase !== 'pronto' && (
        <div
          className={`capa ${fase === 'saindo' ? 'saindo' : ''}`}
          onAnimationEnd={() => fase === 'saindo' && setFase('pronto')}
        >
          <video
            className="filme"
            src={`${import.meta.env.BASE_URL}heroe/alee.mp4`}
            autoPlay
            muted
            playsInline
            preload="auto"
            onPlaying={aoComecarVideo}
            onEnded={sair}
            onError={sair}
          />
        </div>
      )}
    </section>
    </div>
  )
}

export default Heroe