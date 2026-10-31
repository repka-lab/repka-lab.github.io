// What every chart on the site shares: the frame it is drawn in, and the error a chart block in an article
// throws when it cannot be drawn, which the build reports with the article's file name.

export class ChartError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChartError';
  }
}

export function figure(kind: string, caption: string, content: string): string {
  return `<figure class="chart ${kind}">
  <figcaption>${caption}</figcaption>
  ${content}
</figure>`;
}
