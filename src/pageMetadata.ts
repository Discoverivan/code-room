export function pageMetadata(pathname: string, origin: string, href: string) {
  const isRoom = pathname.startsWith("/room/");
  return {
    robots: isRoom ? "noindex, nofollow" : "index, follow",
    canonical: new URL("/", origin).href,
    openGraphUrl: isRoom ? href : new URL("/", origin).href
  };
}

export function updatePageMetadata(pathname: string) {
  const metadata = pageMetadata(pathname, location.origin, location.href);
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const openGraphUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');

  robots?.setAttribute("content", metadata.robots);
  canonical?.setAttribute("href", metadata.canonical);
  openGraphUrl?.setAttribute("content", metadata.openGraphUrl);
}
