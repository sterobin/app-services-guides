const yaml = require("yaml");
const path = require("path");
const asciidoctor = require('asciidoctor')();

const buildQuickStart = (content, basePath, asciidocOptions) => {

  const snippetCache = {};

  const loadSnippet = (ref, tag, type) => {
    if (!snippetCache[ref]) {
      const parts = ref.split("#");
      if (parts.length !== 2) {
        throw Error(`malformed ${tag} ${ref}, must be like !${tag} README.adoc#task-1`);
      }
      const fileName = parts[0];
      const filePath = path.normalize(path.join(basePath, fileName));
      const adoc = asciidoctor.loadFile(filePath, asciidocOptions);
      // create an array with all the blocks in the doc in it
      const blocks = flattenBlocks(adoc);
      blocks
        // only blocks with an id can be used
        .filter(block => block.getId())
        // If we are looking for a particular moduleType, we can filter for it
        .filter(block => type ? getModuleType(block) === type : true)
        .forEach(block => {
          const id = block.getId().replace(/-\{context\}$/, "");
          snippetCache[`${fileName}#${id}`] = block;
        });
    }
    if (!snippetCache[ref]) {
      throw new Error(`unable to locate snippet for ${tag} ${ref}`);
    }
    return snippetCache[ref];
  }

  const flattenBlocks = (block) => {
    const flat = [];

    flat.push(block);
    if (block.hasBlocks()) {
      block.getBlocks().forEach(block => {
          flat.push(...flattenBlocks(block));
      });
    }
    return flat;
  }

  const snippetTag = {
    identify: value => value instanceof asciidoctor.AbstractBlock,
    tag: '!snippet',
    resolve: (doc, cst) => loadSnippet(cst.strValue, "!snippet").convert(),
    stringify(item) {
      return item.convert();
    }
  };

  const procTag = {
    identify: value => value instanceof asciidoctor.AbstractBlock && getModuleType(value) === "proc",
    tag: '!snippet/proc',
    resolve: (doc, cst) => {
      return {
        "proc": loadSnippet(cst.strValue, "!snippet/proc", "proc").convert()
      }
    },
    stringify(item) {
      return item.convert();
    }
  };

  const titleTag = {
    identify: value => value instanceof asciidoctor.AbstractBlock,
    tag: '!snippet/title',
    resolve: (doc, cst) => loadSnippet(cst.strValue, "!snippet/title").getTitle(),
    stringify(item) {
      return item.convert();
    }
  };

  // load the yaml
  const qs = yaml.parse(content.toString(), {
    customTags: [snippetTag, procTag, titleTag]
  });

  // transform the yaml to json for the browser to load
  return JSON.stringify(qs);
}

const MODULE_TYPE_ATTRIBUTE = "module-type";

const getModuleType = (node) => {
  if (node.getAttributes()[MODULE_TYPE_ATTRIBUTE]) {
    return node.getAttributes()[MODULE_TYPE_ATTRIBUTE];
  }

  const id = node.getId();

  if (id && id.startsWith("con-")) {
    return "con";
  }

  if (id && id.startsWith("proc-")) {
    return "proc";
  }

  if (id && id.startsWith("ref-")) {
    return "ref";
  }
  return "unknown"; // punt, we don't know
}

exports.buildQuickStart = buildQuickStart;
