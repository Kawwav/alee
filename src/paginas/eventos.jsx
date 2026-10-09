import { useEffect, useRef, useState } from 'react'
import './eventos.css'
import { lenis } from '../rolagem.js'

const BASE = import.meta.env.BASE_URL

const EVENTOS = [
  {
    id: 'amae',
    nome: 'Amaê Festival',
    data: '07 a 08 de novembro, 2026',
    local: 'Recinto de Exposições Alberto Bertelli Lucatto',
    imagem: `${BASE}eventos/Amae.webp`,
    proporcao: '16 / 9',
  },
  {
    id: 'boomrap',
    nome: 'BOOMRAP Festival',
    data: '12 a 13 de dezembro, 2026',
    local: 'Estádio Kleber Andrade',
    imagem: `${BASE}eventos/boomrap.webp`,
    proporcao: '4 / 5',
  },
]

const TEXTO_FINAL = 'Saiba mais'
const SIMBOLOS = '#$%&*+=?/<>[]{}'

const embaralhar = (el) => {
  clearInterval(el._timer)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = TEXTO_FINAL
    return
  }
  let passo = 0
  const quadro = () => {
    el.textContent = [...TEXTO_FINAL]
      .map((letra, i) =>
        letra === ' ' || passo >= i * 2 + 2
          ? letra
          : SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)]
      )
      .join('')
    passo++
    if (passo > TEXTO_FINAL.length * 2 + 2) {
      clearInterval(el._timer)
      el.textContent = TEXTO_FINAL
    }
  }
  quadro()
  el._timer = setInterval(quadro, 40)
}

function Eventos() {
  const secao = useRef(null)
  const rotulo = useRef(null)
  const texto = useRef(null)
  const mouse = useRef({ visivel: false, x: 0, y: 0, raf: 0 })
  const [ativo, setAtivo] = useState(0)

  useEffect(() => {
    let topo = 0
    let total = 1
    let raf = 0

    const medir = () => {
      const el = secao.current
      if (!el) return
      topo = el.offsetTop
      total = Math.max(el.offsetHeight - window.innerHeight, 1)
    }

    const atualizar = () => {
      raf = 0
      const progresso = Math.min(Math.max((window.scrollY - topo) / total, 0), 1)
      setAtivo(Math.round(progresso * (EVENTOS.length - 1)))
    }

    const aoRolar = () => {
      if (!raf) raf = requestAnimationFrame(atualizar)
    }

    const aoRedimensionar = () => {
      medir()
      aoRolar()
    }

    medir()
    atualizar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    window.addEventListener('resize', aoRedimensionar)
    window.addEventListener('load', aoRedimensionar)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', aoRolar)
      window.removeEventListener('resize', aoRedimensionar)
      window.removeEventListener('load', aoRedimensionar)
    }
  }, [])

  useEffect(() => {
    const m = mouse.current
    const el = texto.current
    return () => {
      cancelAnimationFrame(m.raf)
      if (el) clearInterval(el._timer)
    }
  }, [])

  const irPara = (i) => {
    const el = secao.current
    if (!el) return
    const total = el.offsetHeight - window.innerHeight
    const y = el.offsetTop + (total * i) / (EVENTOS.length - 1)
    if (lenis) {
      lenis.scrollTo(y, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) })
    } else {
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const esconderRotulo = () => {
    const m = mouse.current
    if (!m.visivel) return
    m.visivel = false
    rotulo.current?.classList.remove('saiba-mais--visivel')
    if (texto.current) {
      clearInterval(texto.current._timer)
      texto.current.textContent = TEXTO_FINAL
    }
  }

  const moverNoCartaz = (e) => {
    if (e.pointerType !== 'mouse') return
    if (!e.currentTarget.classList.contains('cartaz--ativo')) {
      esconderRotulo()
      return
    }
    const m = mouse.current
    m.x = e.clientX
    m.y = e.clientY
    if (!m.visivel) {
      m.visivel = true
      rotulo.current.classList.add('saiba-mais--visivel')
      embaralhar(texto.current)
    }
    if (!m.raf) {
      m.raf = requestAnimationFrame(() => {
        m.raf = 0
        if (rotulo.current) {
          rotulo.current.style.transform = `translate3d(${m.x}px, ${m.y}px, 0) translate(-50%, -50%)`
        }
      })
    }
  }

  return (
    <section
      id="eventos"
      className="eventos"
      ref={secao}
      style={{ '--qtd': EVENTOS.length }}
    >
      <div className="eventos__palco">
        <div className="eventos__lista">
          <h2 className="eventos__rotulo">Próximos eventos</h2>
          <ul className="eventos__botoes">
            {EVENTOS.map((e, i) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={i === ativo ? 'eventos__item eventos__item--ativo' : 'eventos__item'}
                  onClick={() => irPara(i)}
                  aria-current={i === ativo}
                >
                  <span className="eventos__item__indice">[{i + 1}]</span>
                  <span className="eventos__item__nome">{e.nome}</span>
                </button>
                {i === ativo && <p className="eventos__item__local">{e.local}</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="eventos__imagens" aria-hidden="false">
          <div
            className="trilho"
            style={{ '--ativo': ativo }}
          >
            {EVENTOS.map((e, i) => {
              const [num, den] = e.proporcao.split('/').map(Number)
              return (
                <div
                  key={e.id}
                  className={i === ativo ? 'slide slide--ativo' : 'slide'}
                >
                  <figure
                    className={i === ativo ? 'cartaz cartaz--ativo' : 'cartaz'}
                    style={{ '--proporcao': e.proporcao, '--razao': num / den }}
                    onPointerMove={moverNoCartaz}
                    onPointerLeave={esconderRotulo}
                  >
                    <span className="canto canto--se" />
                    <span className="canto canto--sd" />
                    <span className="canto canto--ie" />
                    <span className="canto canto--id" />
                    <img src={e.imagem} alt={`Cartaz do ${e.nome}`} />
                  </figure>
                  <div className="evento-info">
                    <h3 className="evento-info__nome">{e.nome}</h3>
                    <p className="evento-info__data">{e.data}</p>
                    <p className="evento-info__local">{e.local}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="eventos__datas">
          <h2 className="eventos__rotulo">Data</h2>
          <ul>
            {EVENTOS.map((e, i) => (
              <li key={e.id}>
                <span className={i === ativo ? 'data data--ativa' : 'data'}>
                  {e.data}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <span className="saiba-mais" ref={rotulo} aria-hidden="true">
          <span className="saiba-mais__caixa">
            <span className="saiba-mais__texto" ref={texto}>{TEXTO_FINAL}</span>
          </span>
        </span>
      </div>
    </section>
  )
}

export default Eventos