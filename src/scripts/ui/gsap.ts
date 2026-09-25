import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let ready = false;
/** GSAP + ScrollTrigger, synchronisés avec le défilement fluide (Lenis) s'il est actif. */
export function useGsap() {
  if (!ready) {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = (window as any).__lenis;
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.lagSmoothing(0);
    }
    ready = true;
  }
  return { gsap, ScrollTrigger };
}
