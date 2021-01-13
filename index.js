const { promisify } = require("util");
const child_process = require("child_process");

const get_def_html = async (term, dic_name) => {
  try {
    const { stdout: html } = await promisify(child_process.exec)(
      `dicmd -t '${term}' -d '${dic_name}' -f 2`,
      {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 1024,
      }
    );
    return html;
  } catch (e) {
    return "";
  }
};

module.exports = async (req, res) => {
  if (!req.url.startsWith("/?")) return;
  const query = req.url.substring(1);
  let { t: term, d: dic_names } = [
    ...new URLSearchParams(query).entries(),
  ].reduce((acc, [k, v]) => {
    if (acc[k]) {
      if (typeof acc[k] === "string") acc[k] = [acc[k]];
      acc[k].push(v);
    } else {
      acc[k] = v;
    }
    return acc;
  }, {});

  if (!term) return res.end(`Must supply term with t=[term]`);
  if (!dic_names) dic_names = ["English"];
  if (typeof dic_names === "string") dic_names = [dic_names];
  try {
    const htmls = await Promise.all(
      dic_names.map((dic_name) => get_def_html(term, dic_name))
    );
    html = `
  <!doctype html>
  <html>
  <head>
    <title>dicsrv: ${term}</title>
  </head>
  <body>
    ${htmls.join("")}
    <script>
      class Webview extends HTMLElement {
        connectedCallback() {
          const shadow = this.attachShadow({ mode: 'open' });
          const template = this.previousElementSibling.content;
          shadow.appendChild(template.cloneNode(true));
        }
      }

      window.customElements.define('web-view', Webview);
      document.querySelectorAll('template').forEach((t)=> {
        const wv = document.createElement('web-view');
        t.parentNode.insertBefore(wv, t.nextElementSibling);
      });
    </script>`;
    res.end(html);
  } catch (e) {
    res.end(`Error occured: ${e.message}`);
  }
};
