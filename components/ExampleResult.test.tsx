import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savedExample } from "@/lib/example";
import { STYLES } from "@/lib/schema";
import { ExampleResult } from "./ExampleResult";

const noop = () => {};
const escape = (s: string) => renderToStaticMarkup(<>{s}</>);

afterEach(() => vi.unstubAllGlobals());

describe("ExampleResult", () => {
  it.each(STYLES)("shows the saved %s listing without a network call", (style) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { listing, model } = savedExample.results[style];

    const html = renderToStaticMarkup(<ExampleResult style={style} headingRef={null} onCopied={noop} />);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(html).toContain("Example listing</h2>");
    expect(html).toContain(escape(listing.caption));
    expect(html).toContain(escape(listing.whatsapp_status));
    expect(html).toContain(`written by ${model} on`);
    expect(html).toContain("not a live generation");
  });

  it("offers no Regenerate button, since nothing is generated", () => {
    const html = renderToStaticMarkup(<ExampleResult style="pidgin" headingRef={null} onCopied={noop} />);
    expect(html).not.toContain("Regenerate");
  });
});
