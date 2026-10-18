// English site pages (about, editorial policy, contact, privacy): URL /en/<file name>/.
export default {
  layout: "page.njk",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/en/${data.page.fileSlug}/`),
    eleventyExcludeFromCollections: (data) => !!data.draft,
  },
};
