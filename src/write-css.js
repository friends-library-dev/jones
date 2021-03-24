// @ts-check
const fs = require(`fs`);
const { paperbackInterior: css } = require(`@friends-library/doc-css`);

fs.writeFileSync(
  `${__dirname}/preview.css`,
  css({
    runningHeadTitle: `Preview`,
    printSize: `m`,
    numFootnotes: 10,
  }),
);
