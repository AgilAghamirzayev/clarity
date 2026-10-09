# Clarity UI direction

Keep the product recognizable: green accents, evidence-linked support insights, and one clear title per page. Use a quiet workspace shell, readable Roboto type, white cards, tonal selection states, and rounded controls. Preserve sample attribution and operational guidance.

## Interaction contract

- Primary actions use filled buttons. Secondary actions use outlined or text buttons. Controls provide visible hover, pressed, focus, and disabled states.
- The active navigation pill moves with a damped spring. Page entrances use a 240 ms, 8 px translation while text stays fully opaque. Query changes do not remount the page, so typing and filters keep focus.
- Dialogs open in 260 ms and close in 140 ms. Mobile navigation slides from the left. Radix manages focus trapping, Escape, and exit unmounting.
- Route loading stays inside the main content so the navigation remains usable.
- Motion honors the operating system's reduced-motion setting, including changes while the app is open. Reduced motion disables spatial animations, CSS transitions, and skeleton pulsing.
- Small screens retain 44 px primary controls and 16 px form inputs. Wide tables scroll within their own region.
- Static cards do not lift on hover. No looping decoration, delayed controls, or staged content reveals.

## References

Adapted from [Material button hierarchy](https://material-web.dev/components/button/) and [Material shape roles](https://material-web.dev/theming/shape/) using Clarity's own colors and components. Animation behavior follows [Motion accessibility](https://motion.dev/docs/react-accessibility) and [Radix animation lifecycle](https://www.radix-ui.com/primitives/docs/guides/animation).

The local style catalogue's marketing page layouts did not fit this application. The existing dashboard structure remains the basis; flat surfaces, readable typography, and restrained motion are the applicable guidance.
