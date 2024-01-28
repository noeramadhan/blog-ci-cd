const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const minify = require('@node-minify/core');
const cleanCSS = require('@node-minify/clean-css');
const htmlMinifier = require('@node-minify/html-minifier');
const showdown = require('showdown');
const converter = new showdown.Converter({ metadata: true, ghCompatibleHeaderId: true, requireSpaceBeforeHeadingText: true, emoji: true });

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

const compileTemplate = (template, data) => handlebars.compile(template)(data);
const getFile = (file) => fs.readFileSync(file, 'utf8');
const getPath = (source = 'build', option = []) => path.join(process.env.DIRNAME, ...[source, ...option]);
const findFile = (data, match) => data.find((item) => item.split(match).length > 1);
const isFile = (filePath) => fs.lstatSync(filePath).isFile();
const getFiles = (source, data = []) =>
  fs
    .readdirSync(source)
    .map((fileName) => {
      const fileFullPath = path.join(source, fileName);
      return isFile(fileFullPath) ? fileFullPath : getFiles(fileFullPath, data);
    })
    .flat(2);

const minifyCSS = () => {
  const data = findFile(getFiles(getPath('src')), '.css');
  minify({
    compressor: cleanCSS,
    input: data,
    output: getPath('build', [data.split('src\\')[1]]),
  });
};

const minifyContent = (data, type = 'list') => {
  const sourceFiles = getFiles(getPath('src'));
  const sectionTemplateFile = findFile(sourceFiles, `-${type}.hbs`);
  const indexTemplateFile = findFile(sourceFiles, 'index.hbs');
  const section = compileTemplate(getFile(sectionTemplateFile), data);
  const stylePath = type !== 'list' ? '../' : '';
  const title = type === 'list' ? 'Blog' : 'Blog | ' + data.title;
  const indexHtml = compileTemplate(getFile(indexTemplateFile), { section, path: stylePath, title });

  minify({
    compressor: htmlMinifier,
    content: indexHtml,
    options: minifyOptions,
  }).then((res) => {
    fs.writeFile(getPath('build', type === 'list' ? ['index.html'] : [data.slug]), res, (err) => {
      if (err) console.log(err);
    });
  });
};

const cleanBuildDir = () => {
  const buildDir = getPath('build');
  const buildPostDir = getPath('build', ['posts']);

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);
  fs.readdirSync(buildDir).forEach((f) => fs.rmSync(`${buildDir}/${f}`, { recursive: true }));
  if (!fs.existsSync(buildPostDir)) fs.mkdirSync(buildPostDir);
};

const minifyPosts = () => {
  cleanBuildDir();
  minifyCSS();
  minifyContent({
    post: getFiles(getPath('src', ['posts']))
      .map((item) => {
        const content = converter.makeHtml(getFile(item));
        const { title, date } = converter.getMetadata();
        const tag = date
          .split('/')
          .map((item) => item.padStart(2, '0'))
          .join('');
        const slug = 'posts\\' + item.split('posts\\')[1].split('.md')[0] + '.html';
        minifyContent({ slug, title, tag, content }, 'main');
        let helper = date.split('/');
        return {
          slug,
          title,
          tag,
          date: new Date(helper[2], helper[1] - 1, helper[0]).toLocaleDateString('EN-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
          }),
        };
      })
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
  });
};

// minifyPosts();
