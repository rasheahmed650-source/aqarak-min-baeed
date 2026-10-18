// English articles (written by the translation workflow): URL /en/slug/, drafts never published.
export default {
  layout: "post.njk",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/en/${data.slug || data.page.fileSlug}/`),
    eleventyExcludeFromCollections: (data) => !!data.draft,
  },
};
