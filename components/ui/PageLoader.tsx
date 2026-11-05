import "./page-loader.css";

export function PageLoader({
  title = "Memuat halaman…",
  inline = false,
}: {
  title?: string;
  inline?: boolean;
}) {
  return (
    <div role="status" className={inline ? "page-loader page-loader-inline" : "page-loader"}>
      <div className="page-loader-status page-loader-reveal">
        <span className="page-loader-indicator" aria-hidden="true" />
        <span>{title}</span>
      </div>
    </div>
  );
}
