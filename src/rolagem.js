import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const reduzir =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const lenis = reduzir
  ? null
  : new Lenis({
      lerp: 0.06,
      wheelMultiplier: 0.85,
      smoothWheel: true,
    })

if (lenis) {
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((tempo) => lenis.raf(tempo * 1000))
  gsap.ticker.lagSmoothing(0)
}
