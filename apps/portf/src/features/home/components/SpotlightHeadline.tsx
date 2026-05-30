/**
 * V2 spotlight headline + sub-line.
 *
 * Stateless. Faithful to design source
 * (docs/superpowers/artifacts/cosimi2/project/variations-1-2.jsx:152-160).
 * Copy is hardcoded English; Phase H will replace with i18n lookups.
 */
export function SpotlightHeadline() {
  return (
    <>
      <h1 className="v2-headline">
        Hello, I'm <em>Long NGUYỄN.</em>
        <br />
        What would you like
        <br />
        to know?
      </h1>
      <p className="v2-sub">
        Senior Web Developer · product-minded · 10+ years shipping production web apps. Everything
        on this site is a chat - ask anything, or pick a prompt below.
      </p>
    </>
  );
}
