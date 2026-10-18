// Everything under src/en/ is the English version, published under /en/.
// It reads the English copies of the site settings, home page text, sections and tools.
export default {
  lang: "en",
  eleventyComputed: {
    site: (d) => ({ ...d.site, ...(d.site_en || {}), url: d.site.url, phone: d.site.phone, social: d.site.social,
      google_verification: d.site.google_verification, bing_verification: d.site.bing_verification }),
    home: (d) => d.home_en || d.home,
    sections: (d) => d.sections_en || d.sections,
    tools: (d) => d.tools_en || d.tools,
  },
};
