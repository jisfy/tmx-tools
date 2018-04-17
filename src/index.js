
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
  console.log('image loaded, ...' + image.bitmap.width + '.' + image.bitmap.height);
  var tileTopLeftCoordinates = tmxTools.getTileTopLeftCoordinates(
      image.bitmap.width, 
      image.bitmap.height, 
      tileWidth, 
      tileHeight);
  // var tileset = tmxTools.tilesetFromImage(image, tileTopLeftCoordinates);
  var tilesetPromise = tmxTools.tilesetFromImage(image, tileTopLeftCoordinates, tileWidth, tileHeight);
  tilesetPromise.then(function (tileset) {
    console.log('...... tileset ' + tileset.mapping);
    var g = 0;
    _.each(tileset.tiles, x => {var filename = "./assets/p_" + g + ".png";console.log("writing " + filename);x.write(filename); g++;});
  });
  // console.log('...... tileset ' + tileset.mapping);
  // var g = 0;
  // _.each(tileset.tiles, x => {var filename = "./assets/p_" + g + ".png";console.log("writing " + filename);x.write(filename); g++;});
  // return outputImage.blit(image, 0, 0, 0, 0, 300, 300);
}).catch(function (err) {
  console.log('couldnt load image ' + err.message);
});

