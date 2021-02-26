const yaml = require("yaml");
const path = require("path");
const jp = require("jsonpath");
const fs = require("fs");
const {JSDOM} = require("jsdom");
const fetch = require('sync-fetch');

const pantheonBaseUrl = process.env.PANTHEON_URL || "https://pantheon.corp.redhat.com/api";

const buildQuickStart = (content, basePath, asciidocOptions) => {

  const pantheonMappingPath = path.join(basePath, "pantheon.yml");
  // load the pantheon mappings
  const pantheonMapping = yaml.parse(fs.readFileSync(pantheonMappingPath).toString());

  const loadFromPantheon = (ref, tag, defaultPathExpression, defaultCssSelector) => {
    const mapping = pantheonMapping[`${tag} ${ref}`];
    if (!mapping) {
      throw new Error(`${tag} ${ref} mapping to pantheon API is undefined`);
    }
    let uuid, type, cssSelector, pathExpression;

    if (typeof mapping === "object") {
      uuid = mapping["uuid"];
      type = mapping["type"];
      cssSelector = mapping["cssSelector"] || defaultCssSelector;
      pathExpression = mapping["jsonPathExpression"] || defaultPathExpression;
    } else if (typeof mapping === "string"){
      if (mapping.startsWith("https")) {
        const parts = mapping.match(/https:\/\/.*\/api\/(\w*)\/.*\/([a-z0-9-]*)/);
        if (parts.length !== 3) {
          throw new Error(`Unable to parse ${mapping} as pantheon URL`);
        }
        type = parts[1];
        uuid = parts[2];
        cssSelector = defaultCssSelector;
        pathExpression = defaultPathExpression;
      }
    } else {
      throw new Error("${tag} ${ref} mapping to pantheon API is unsupported, should either be a URL or have keys for uuid and type");
    }

    if (!uuid) {
      throw new Error(`uuid not set in ${pantheonMappingPath}`)
    }
    if (!type) {
      throw new Error(`type not set in ${pantheonMappingPath}`)
    }
    const data = loadFromPantheonApi(uuid, type, pathExpression);
    const result = jp.nodes(data, pathExpression);
    return result
      .map(node => {
        const path = node["path"];
        if (cssSelector && path && path[path.length - 1] === "body") {
          const dom = new JSDOM(node["value"]);
          return dom.window.document.querySelector(cssSelector);
        }
        return node["value"];
      })
      .reduce(((previousValue, currentValue) => `${previousValue} ${currentValue}`), "");
  };

  const loadFromPantheonApi = (uuid, type) => {
    const url = `${pantheonBaseUrl}/${type}/variant.json/${uuid}`;
    const res = fetch(url)
    if (res.status != 200) {
      throw new Error(`error fetching from pantheon ${res.status} ${res.text()}`)
    }
    return res.json();
  };

  const snippetTag = {
    identify: false,
    tag: '!snippet',
    resolve: (doc, cst) => {
      const parts = cst.strValue.split("#");
      if (parts.length !== 2) {
        throw Error(`malformed !snippet ${cst.str}, must be like !snippet README.adoc#task-1`);
      }
      const id = parts[1];
      return loadFromPantheon(cst.strValue, "!snippet", '$.module.body', `#${id}`)
    },
    stringify: () => ""
  };

  const procTag = {
    identify: false,
    tag: '!snippet/proc',
    resolve: (doc, cst) => {
      return {
        "proc": loadFromPantheon(cst.strValue, "!snippet/proc", '$.module.body')
      }
    },
    stringify: () => ""
  };

  const titleTag = {
    identify: false,
    tag: '!snippet/title',
    resolve: (doc, cst) => loadFromPantheon(cst.strValue, "!snippet/title", '$.assembly.title'),
    stringify: () => ""
  };

  // load the yaml
  const qs = yaml.parse(content.toString(), {
    customTags: [snippetTag, procTag, titleTag]
  });

  // transform the yaml to json for the browser to load
  return JSON.stringify(qs);
}

exports.buildQuickStart = buildQuickStart;
