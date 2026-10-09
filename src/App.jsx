import { useEffect, useRef, useState } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './App.css'
import Heroe from './paginas/heroe.jsx'
import Album from './paginas/album.jsx'
import Eventos from './paginas/eventos.jsx'
import Redes from './paginas/redes.jsx'
import Footer from './componentes/footer.jsx'
import Jogo from './jogo/jogo.jsx'
import { lenis } from './rolagem.js'

const rolarPara = (y) => {
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
  else window.scrollTo(0, y)
}

function App() {
  const [redesVisiveis, setRedesVisiveis] = useState(false)
  const [rota, setRota] = useState(() => window.location.hash)
  const noJogo = rota === '#/jogo'
  const [siteMontado, setSiteMontado] = useState(!noJogo)
  const posicao = useRef(0)
  const primeira = useRef(true)

  useEffect(() => {
    const aoMudar = () => {
      if (window.location.hash === '#/jogo') posicao.current = window.scrollY
      setRota(window.location.hash)
    }
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  useEffect(() => {
    if (noJogo) {
      primeira.current = false
      rolarPara(0)
      return
    }
    setSiteMontado(true)
    if (primeira.current) {
      primeira.current = false
      return
    }
    rolarPara(posicao.current)
    window.dispatchEvent(new Event('resize'))
    ScrollTrigger.refresh()
  }, [noJogo])

  return (
    <>
      {siteMontado && (
        <div style={noJogo ? { display: 'none' } : undefined}>
          <Heroe aoLiberar={() => setRedesVisiveis(true)} />
          <Album />
          <div className="cortina">
            <Eventos />
            <Footer />
          </div>
          <Redes visivel={redesVisiveis} />
        </div>
      )}
      {noJogo && <Jogo />}
    </>
  )
}

export default App