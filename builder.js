import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handlebars from 'handlebars';
import minify from '@node-minify/core';
import cleanCSS from '@node-minify/clean-css';
import htmlMinifier from '@node-minify/html-minifier';
import showdown from 'showdown';

const converter = new showdown.Converter({
  metadata: true,
  ghCompatibleHeaderId: true,
  requireSpaceBeforeHeadingText: true,
  emoji: true,
});

const minifyOptions = {
  collapseBooleanAttributes: true,
  collapseInlineTagWhitespace: true,
  collapseWhitespace: true,
  conservativeCollapse: true,
  decodeEntities: true,
  includeAutoGeneratedTags: false,
  minifyCSS: true,
  minifyJS: true,
  minifyURLs: true,
  preventAttributesEscaping: true,
  processConditionalComments: true,
  removeAttributeQuotes: false,
  removeComments: true,
  removeEmptyAttributes: true,
  removeOptionalTags: false,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  sortAttributes: true,
  sortClassName: true,
  trimCustomFragments: true,
  useShortDoctype: true,
  keepClosingSlash: true,
};

/**
 * Compiles the given template with the given data.
 *
 * The function uses the `handlebars.compile` function to compile the `template` with the `data`.
 *
 * @param {string} template - The template to compile. The template must be written in the Handlebars syntax.
 * @param {object} data - The data to use in the template.
 * @returns {string} The compiled template.
 */
const compileTemplate = (template, data) => handlebars.compile(template)(data);

/**
 * Returns the absolute file path for the given parts.
 *
 * The function uses the `path.resolve` and `path.dirname` functions to join the given `paths` with the
 * directory of the current module, as determined by `import.meta.url`.
 *
 * @param {...string} paths - The parts of the file path to join.
 * @returns {string} The absolute file path.
 */
const getPath = (...paths) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), ...paths);

/**
 * Returns the first file path that includes the given pattern.
 *
 * The function uses the `Array.prototype.find` method to return the first file path from the `data`
 * array that includes the `pattern` string. If no file path includes the pattern, the function returns
 * `undefined`.
 *
 * @param {string[]} data - An array of file paths.
 * @param {string} pattern - The pattern to search for in the file paths.
 * @returns {string|undefined} The first file path that includes the given pattern, or `undefined` if no file path includes the pattern.
 */
const findFile = (data, pattern) => data.find((file) => file.includes(pattern));

/**
 * Returns an array of file paths that include the given pattern.
 *
 * The function uses the `Array.prototype.filter` method to return an array of file paths from the `data`
 * array that include the `pattern` string.
 *
 * @param {string[]} data - An array of file paths.
 * @param {string} pattern - The pattern to search for in the file paths.
 * @returns {string[]} An array of file paths that include the given pattern.
 */
const findFiles = (data, pattern) => data.filter((file) => file.includes(pattern));

/**
 * Returns the contents of the given file as a string.
 *
 * The function uses the `fs.readFileSync` function to read the contents of the `file` and returns it as
 * a string. The file is read with the 'utf8' encoding.
 *
 * @param {string} file - The path to the file.
 * @param {string} encoding - The encoding to use when reading the file. Default is 'utf8'.
 * @returns {string} The contents of the file.
 */
const getFile = (file) => fs.readFileSync(file, 'utf8');

/**
 * Returns an array of file paths in the given directory and its subdirectories.
 *
 * The function uses the `fs.readdirSync` function to get an array of file and directory names in the
 * `source` directory, and then uses the `fs.statSync` function to determine whether each item is a file
 * or a directory. If the item is a directory, the function recursively calls itself with the directory's
 * path. If the item is a file, the function adds the file's path to the array of file paths.
 *
 * @param {string} source - The path to the directory to search for files.
 * @returns {string[]} An array of file paths.
 */
const getFiles = (source) =>
  fs.readdirSync(source).flatMap((fileName) => {
    const fileFullPath = path.join(source, fileName);
    return fs.statSync(fileFullPath).isDirectory() ? getFiles(fileFullPath) : fileFullPath;
  });

const sourceDirPath = getPath('src');
const sourcePostDirPath = getPath('src', 'posts');
const buildDirPath = getPath('build');
const buildPostDirPath = getPath('build', 'posts');
const sourceDirFiles = getFiles(sourceDirPath);

/**
 * Minifies the given CSS file in the source directory using the clean-css library.
 *
 * The `sourceDirFiles` array must contain a file with a '.css' extension. This file will be
 * minified and saved to the build directory using the same file name.
 *
 * @param {string[]} sourceDirFiles - An array of file paths in the source directory.
 * @returns {void}
 */
const minifyStyle = () => {
  const styleFile = findFile(sourceDirFiles, '.css');
  const [, styleFileName] = styleFile.split(path.join('src', path.sep));

  minify({
    compressor: cleanCSS,
    input: styleFile,
    output: getPath('build', styleFileName),
    options: minifyOptions,
  });
};

/**
 * Minifies the given HTML content using the html-minifier library.
 *
 * The `data` parameter can be either a string of HTML content or an object containing data to be
 * used for rendering an HTML template. If `data` is an object, the function will search for the
 * appropriate Handlebars template in the `sourceDirFiles` array and render the template using the
 * given data.
 *
 * The `type` parameter specifies the type of content to render. If `type` is 'list', the function
 * will search for the 'index.hbs' template and render it using the given data. If `type` is
 * 'post', the function will search for the '-post.hbs' template and render it using the given data.
 *
 * @param {string|object} data - The data to use for rendering the HTML template.
 * @param {string} [type='list'] - The type of content to render. Default is 'list'.
 * @param {string[]} sourceDirFiles - An array of file paths in the source directory.
 * @param {object} minifyOptions - The options to pass to the html-minifier library.
 * @returns {void}
 */
const minifyContent = async (data, type = 'list') => {
  const stylePath = type !== 'list' ? `..${path.sep}` : '';
  const title = `Blog${type !== 'list' ? ` | ${data.title}` : ''}`;
  const total = Array.isArray(data?.post) ? data.post.length : 1;
  const paths = type === 'list' ? 'index.html' : data.slug;

  const sectionTemplateFile = findFile(sourceDirFiles, `-${type}.hbs`);
  const indexTemplateFile = findFile(sourceDirFiles, 'index.hbs');
  const sectionHtml = compileTemplate(getFile(sectionTemplateFile), data);

  const indexData = { section: sectionHtml, path: stylePath, title, total };
  const indexHtml = compileTemplate(getFile(indexTemplateFile), indexData);

  const result = await minify({
    compressor: htmlMinifier,
    content: indexHtml,
    options: minifyOptions,
  });
  fs.writeFileSync(getPath('build', paths), result);
};

/**
 * Minifies the HTML content for all posts in the source post directory using the html-minifier library.
 *
 * The function searches for all Markdown files in the `sourcePostDirPath` directory, converts each file
 * to HTML using the `converter` library, and extracts the title, date, and tags from the file's
 * metadata. It then minifies the HTML content for each post and saves it to the build directory using
 * the appropriate file name.
 *
 * Finally, the function minifies the HTML content for a list of all posts and saves it to the build
 * directory as 'index.html'.
 *
 * @param {string[]} sourcePostDirPath - An array of file paths in the source post directory.
 * @param {object} converter - An instance of the `converter` library.
 * @param {object} minifyOptions - The options to pass to the html-minifier library.
 * @param {string[]} sourceDirFiles - An array of file paths in the source directory.
 * @returns {void}
 */
const minifyPosts = () => {
  const postsData = getFiles(sourcePostDirPath).map((file) => {
    const content = converter.makeHtml(getFile(file));
    const { title, date } = converter.getMetadata();
    const tag = date
      .split('/')
      .map((item) => item.padStart(2, '0'))
      .join('');
    const slug = file.replace(/^.*[\/\\]posts[\/\\](.*).md$/, `posts${path.sep}$1.html`);

    minifyContent({ slug, title, tag, content }, 'main');

    const [day, month, year] = date.split('/');
    const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
    return { slug, title, tag, date: formattedDate };
  });

  const sortedPostsData = [...postsData].sort((oldPost, newPost) => new Date(newPost.date) - new Date(oldPost.date));
  minifyContent({ post: sortedPostsData });
};

/**
 * Minifies the HTML content of all pages in the source directory using the html-minifier library.
 *
 * The function searches for all HTML files in the `sourceDirFiles` array, minifies the HTML content
 * for each file, and saves it to the build directory using the same file name.
 *
 * @param {string[]} sourceDirFiles - An array of file paths in the source directory.
 * @param {object} htmlMinifier - An instance of the `html-minifier` library.
 * @param {object} minifyOptions - The options to pass to the html-minifier library.
 * @returns {void}
 */
const minifyPage = () => {
  findFiles(sourceDirFiles, '.html').map(async (file) => {
    const [, pageFileName] = file.split(path.join('src', path.sep));
    const result = await minify({
      compressor: htmlMinifier,
      content: getFile(file),
      options: minifyOptions,
    });
    fs.writeFileSync(getPath('build', pageFileName), result);
  });
};

/**
 * Removes the contents of the build directory and recreates the build and build/posts directories.
 *
 * The function uses the `fs.rm` function to remove the contents of the `buildDirPath` directory, and
 * then uses the `fs.mkdir` function to recreate the `buildDirPath` and `buildPostDirPath` directories.
 *
 * @param {string} buildDirPath - The path to the build directory.
 * @param {string} buildPostDirPath - The path to the build/posts directory.
 * @param {object} fs - An instance of the Node.js `fs` module.
 * @returns {void}
 */
const cleanBuildDir = () => {
  fs.rmSync(buildDirPath, { recursive: true, force: true });
  [buildDirPath, buildPostDirPath].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
};

cleanBuildDir();
minifyStyle();
minifyPosts();
minifyPage();
