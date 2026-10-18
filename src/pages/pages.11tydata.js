// Fixed site pages (about, editorial policy, contact, privacy): URL comes from the file name.
export default {
  layout: "page.njk",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/${data.page.fileSlug}/`),
    eleventyExcludeFromCollections: (data) => !!data.draft,
  },
};
