
var tmxTools = require('./tmx-tools');
var _ = require('underscore');
var Q = require('q');
var Jimp = require('jimp');
var argv = require('optimist').usage('Usage : $0 -s tile_size -i input_bitmap.png -o output_tilemap.tmx').demand(['s','i', 'o']).argv;

var inputBitmapFileName = argv.i;
var outputTileMapFileName = argv.o;
var tileWidth = argv.s;
var tileHeight = argv.s;

Jimp.read(inputBitmapFileName).then(function (image) {
  var tileTopLeftCoordinates = tmxTools.getTileTopLeftCoordinates(
      image.bitmap.width,
      image.bitmap.height,
      tileWidth,
      tileHeight);
  var tileset$ = tmxTools.tilesetFromImage(image, tileTopLeftCoordinates, tileWidth, tileHeight);
  tileset$.then(function (tileset) {
    /* var g = 0;
    _.each(tileset.tiles, x => {var filename = "./assets/p_" + g + ".png";console.log("writing " + filename);x.write(filename); g++;});
    */
    var mapWidthInTiles = Math.floor(image.bitmap.width / tileWidth);
    var mapHeightInTiles = Math.floor(image.bitmap.height / tileHeight);
    tmxTools.writeTmxFile(tileset,
        [mapWidthInTiles, mapHeightInTiles], [tileWidth, tileHeight]);
  });
}).catch(function (err) {
  console.log('couldnt load image ' + err.message);
});
