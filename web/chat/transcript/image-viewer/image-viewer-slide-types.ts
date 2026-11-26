// A slide whose image has not resolved yet (or failed): rendered by ImageViewer, never by the library's image slide.
declare module "yet-another-react-lightbox" {
  interface SlideTypes {
    pending: { type: "pending"; label: string; failed: boolean };
  }
}

export {};
