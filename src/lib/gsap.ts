import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, SplitText, MorphSVGPlugin, DrawSVGPlugin);

export { gsap, ScrollTrigger, SplitText, MorphSVGPlugin, DrawSVGPlugin };
