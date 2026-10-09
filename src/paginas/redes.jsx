import './redes.css'

const REDES = ['Instagram', 'Spotify']

function Redes({ visivel }) {
  return (
    <ul className={visivel ? 'redes redes--visivel' : 'redes'}>
      {REDES.map((nome) => (
        <li key={nome} className="redes__item">
          {nome}
        </li>
      ))}
    </ul>
  )
}

export default Redes