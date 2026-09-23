/** Opens the first-run tour again from anywhere, such as Settings. `FirstRun` listens for it. */
export const TOUR_EVENT = 'shijima:tour'

export function openTour() {
  window.dispatchEvent(new Event(TOUR_EVENT))
}
