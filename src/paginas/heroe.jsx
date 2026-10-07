import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import './heroe.css'

const TOTAL = 15
const DURACAO_VIDEO = 4000
const ESCRITA_ATRASO = 1.6
const ESCRITA_DURACAO = 2.6
const LIMITE_SEGURANCA = 8000

const reduzirMovimento = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Heroe() {
  const [fase, setFase] = useState(() => (reduzirMovimento() ? 'pronto' : 'video'))
  const timerVideo = useRef(null)
  const timerSeguranca = useRef(null)
  const tituloRef = useRef(null)

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
      gsap.to(tituloRef.current, {
        '--p': 1,
        duration: ESCRITA_DURACAO,
        delay: ESCRITA_ATRASO,
        ease: 'power1.inOut',
      })
    })
    return () => ctx.revert()
  }, [intro])

  const aoComecarVideo = () => {
    if (timerVideo.current) return
    clearTimeout(timerSeguranca.current)
    timerVideo.current = setTimeout(sair, DURACAO_VIDEO)
  }

  return (
    <section className={`secao ${fase === 'video' ? 'tocando' : ''}`}>
      <div className="arco">
        {Array.from({ length: TOTAL }, (_, i) => {
          const meio = (TOTAL - 1) / 2
          const distancia = Math.abs(i - meio) / meio

          return (
            <span
              key={i}
              className="quadrado"
              style={{
                '--angulo': `${-90 + (i * 180) / (TOTAL - 1)}deg`,
                '--distancia': distancia,
              }}
            />
          )
        })}
      </div>

      <div className="imagem">
        <img className="foto" src="/heroe/alee.png" alt="Alee" />
      </div>

      <h1 className="titulo" ref={tituloRef}>
        Alee
      </h1>

      {fase !== 'pronto' && (
        <div
          className={`capa ${fase === 'saindo' ? 'saindo' : ''}`}
          onAnimationEnd={() => fase === 'saindo' && setFase('pronto')}
        >
          <video
            className="filme"
            src="/heroe/alee.mp4"
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
  )
}

export default Heroe