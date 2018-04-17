
var _ = require('underscore');
var XmlWriter = require('simple-xml-writer').XmlWriter;
var Jimp = require('jimp');
// var argv = require('optimist').usage('Usage : $0 -s tile_size -i input_bitmap.png -o output_tilemap.tmx').demand(['s','i', 'o']).argv;
var argv = require('optimist').usage('Usage : $0 -s tile_size -i input_bitmap.png -o output_tilemap.tmx').argv;
var Q = require('q');

var inputBitmapFileName = argv.i;
var outputTileMapFileName = argv.o;
var tileWidth = argv.s;
var tileHeight = argv.s;

/**
 * A TiledMap class
 * @constructor
 * @param {string} name - the TiledMap name
 */
function TiledMap(name) {
  this.name = name;
}

TiledMap.prototype.sayHello = function () {
  console.log(' Hello ' + this.name);
};

var tileMap = new TiledMap('Cowboys vs Ninjas');
tileMap.sayHello();

var tmxOutputFile = new XmlWriter(function (el) {
  el('tmx-file', function (el, at) {
    el('tile-set', function (el, at) {
      at('name', 'test.png');
    }); 
  });
}, { addDeclaration : true });

console.log('data ' + tmxOutputFile.toString());

/**
 * Generates a list of pairs holding the top-left coordinates for each tile candidate
 * in the source image
 *
 * @param {number} imageWidth - the source image width in pixels
 * @param {number} imageHeight - the source image height in pixels
 * @param {number} tileWidth - the tile width in pixels
 * @param {number} tileHeight - the tile height in pixels
 * @return {Array<Array<number, number>>} a list of pairs holding the top-left coordinates
 *     for each tile candidate in the source image
 * @throws {Error} in case the imageWidth is not divisible by the tileWidth, or the 
 *     imageHeight is not divisible by the tileHeight
 */
function getTileTopLeftCoordinates(imageWidth, imageHeight, tileWidth, tileHeight) {
  var imageWidthInTiles = imageWidth / tileWidth;
  var imageHeightInTiles = imageHeight / tileHeight;
  var isNonMultipleHorizontal = (imageWidth % tileWidth != 0);
  var isNonMultipleVertical = (imageHeight % tileHeight != 0);
  if (isNonMultipleHorizontal || isNonMultipleVertical) {
    throw new Error('Can not generate Tile coordinates with image size non divisible by tile size ');
  }
  var tileHorizontalIndexes = _.range(imageWidthInTiles);
  var tileVerticalIndexes = _.range(imageHeightInTiles);
  var getIndexPairsForRow = (horizontalIndex => (tileVerticalIndexes.map(verticalIndex => [horizontalIndex, verticalIndex])));   
  var tileTopLeftCoordinates = _.chain(tileHorizontalIndexes).map(getIndexPairsForRow).
      flatten(true).value();
  return tileTopLeftCoordinates;
}

function tilesetFromImage(image, tileTopLeftCoordinates) {
  var tilesetData_ = {
    mapping : [],
    tiles: [],
    tileMapping : {},
  };
  
  var imageWidthInTiles = image.width / tileWidth;
  var imageHeightInTiles = image.height / tileHeight;

  console.log('tilesetData_.tileMapping ' + tilesetData_.tileMapping);

  var addTiles = function (tilesetDataPromise, topLeftTileCoordinates) {
    var tileAtIndex = new Jimp(tileWidth, tileHeight);
    var tileTargetHorizontalPosition = 0;
    var tileTargetVerticalPosition = 0;  
    var sourceImageHorizontalPosition = topLeftTileCoordinates[0] * tileWidth;
    var sourceImageVerticalPosition = topLeftTileCoordinates[1] * tileHeight;

    console.log('.... adding Tile for ' + sourceImageHorizontalPosition + '.' + sourceImageVerticalPosition); 
    tileAtIndex.blit(image, 
        tileTargetHorizontalPosition, 
        tileTargetVerticalPosition, 
        sourceImageHorizontalPosition, 
        sourceImageVerticalPosition, 
        tileWidth,
        tileHeight);

    var tileAtIndexBase64Promise = Q.ninvoke(tileAtIndex, 'getBase64', Jimp.AUTO);
    var resultPromise = Q.all([tilesetDataPromise, tileAtIndexBase64Promise]).spread(function (tilesetData, tileAtIndexBase64) {
      var isTileHashInTileset = tileAtIndexBase64 in tilesetData.tileMapping;
      console.log('!!!!within Q.all ' + tilesetData.tileMapping + '.... base64 ' + tileAtIndexBase64);
      if (!isTileHashInTileset) {
        console.log('tilesetData.tileMapping ' + tilesetData.tileMapping);
        console.log('tilesetData.tileMapping.mapping ' + tilesetData.mapping);
        console.log('tilesetData.tileMapping.tiles ' + tilesetData.tiles);
        tilesetData.tiles.push(tileAtIndex); 
        console.log('..... tilesetData.tiles.length ' + tilesetData.tiles.length);
        if (tilesetData.mapping[topLeftTileCoordinates[0]] === undefined) {
          tilesetData.mapping[topLeftTileCoordinates[0]] = [];
        }
        tilesetData.mapping[
            topLeftTileCoordinates[0]][topLeftTileCoordinates[1]] = 
                tilesetData.tiles.length;
        tilesetData.tileMapping[tileAtIndexBase64] = tilesetData.tiles.length;
      }
      return Q(tilesetData);
    }); 
    return resultPromise;
  };

  // tilesetData_ = _.reduce(tileTopLeftCoordinates, addTiles, tilesetData_);
  var tilesetDataPromise_ = Q(tilesetData_);
  tilesetDataPromise_ = _.reduce(tileTopLeftCoordinates, addTiles, tilesetDataPromise_);

  return tilesetDataPromise_;
}

/*
 // this is a former implementaiton of tilesetFromImage based on Jimp.hash.
 // Regretfully, Jimp.hash does not yield unique hash values for different images.
function tilesetFromImage(image, tileTopLeftCoordinates) {
  var tilesetData_ = {
    mapping : [],
    tiles: [],
    tileMapping : {},
  };
  
  var imageWidthInTiles = image.width / tileWidth;
  var imageHeightInTiles = image.height / tileHeight;

  // var tileIndexCoordinatesToPixels = (coordinates => [coordinates[0] * tileWidth, coordinates[1] * tileHeight]);

  console.log('tilesetData_.tileMapping ' + tilesetData_.tileMapping);
  var addTiles = function (tilesetData, topLeftTileCoordinates) {
    var tileAtIndex = new Jimp(tileWidth, tileHeight);
    var tileTargetHorizontalPosition = 0;
    var tileTargetVerticalPosition = 0;  
    var sourceImageHorizontalPosition = topLeftTileCoordinates[0] * tileWidth;
    var sourceImageVerticalPosition = topLeftTileCoordinates[1] * tileHeight;

    console.log('.... adding Tile for ' + sourceImageHorizontalPosition + '.' + sourceImageVerticalPosition); 
    tileAtIndex.blit(image, 
        tileTargetHorizontalPosition, 
        tileTargetVerticalPosition, 
        sourceImageHorizontalPosition, 
        sourceImageVerticalPosition, 
        tileWidth,
        tileHeight);
    console.log('tilesetData ' + tilesetData + '..' + tileAtIndex.hash());
    var isTileHashInTileset = tileAtIndex.hash() in tilesetData.tileMapping;
    var differences = _.map(tilesetData.tiles, tile => Jimp.diff(tileAtIndex, tile))
    var isTileDiffWithSomeOtherFromTilesetNonZero = _.some(differences, difference => (difference != 0));
    console.log('---- differences ' + differences + ' .. ' + differences.length + '...' + isTileDiffWithSomeOtherFromTilesetNonZero);
    _.each(differences, x => console.log('******* differences ' + x.percent));
    if (!isTileHashInTileset) {
      console.log('tilesetData.tileMapping ' + tilesetData.tileMapping);
      console.log('tilesetData.tileMapping.mapping ' + tilesetData.mapping);
      console.log('tilesetData.tileMapping.tiles ' + tilesetData.tiles);
      tilesetData.tiles.push(tileAtIndex); 
      console.log('..... tilesetData.tiles.length ' + tilesetData.tiles.length);
      if (tilesetData.mapping[topLeftTileCoordinates[0]] === undefined) {
        tilesetData.mapping[topLeftTileCoordinates[0]] = [];
      }
      tilesetData.mapping[
          topLeftTileCoordinates[0]][topLeftTileCoordinates[1]] = 
              tilesetData.tiles.length;
      tilesetData.tileMapping[tileAtIndex.hash()] = tilesetData.tiles.length;
    }
    return tilesetData;
  };

  tilesetData_ = _.reduce(tileTopLeftCoordinates, addTiles, tilesetData_);
  return tilesetData_;
}
*/

/*
function doSomething(image) {
  var tilesetImages = {};
  var tileAtIndex = new Jimp(tileWidth, tileHeight);
  var tileTargetHorizontalPosition = 0;
  var tileTargetVerticalPosition = 0;  

  var imageWidthInTiles = image.width / tileWidth;
  var imageHeightInTiles = image.height / tileHeight;

  var tileHorizontalIndexes = _.range(imageWidthInTiles);
  var tileVerticalIndexes = _.range(imageHeightInTiles);
  var tileIndexes = _.zip(tileHorizontalIndexes, tileVerticalIndexes);
  var tileTopLeftCoordinates = tileIndexes.map(indexPair => [ indexPair[0] * tileWidth, indexPair[1] * tileHeight ]);

  var horizontalIndex = 0;
  var verticalIndex = 0;
  var sourceImageHorizontalPosition = horizontalIndex * tileWidth;
  var sourceImageVerticalPosition = verticalIndex * tileHeight;

  tileAtIndex.blit(image, 
      tileTargetHorizontalPosition, 
      tileTargetVerticalPosition, 
      sourceImageHorizontalPosition, 
      sourceImageVerticalPosition, 
      tileWidth,
      tileHeight);
  tilesetImages[tileAtIndex.hash()] = tileAtIndex;
}
*/

/*
function doSomething(image) {
  var tilesetImages = {};
  var tileAtIndex = new Jimp(tileWidth, tileHeight);
  var tileTargetHorizontalPosition = 0;
  var tileTargetVerticalPosition = 0;  

  var horizontalIndex = 0;
  var verticalIndex = 0;
  var sourceImageHorizontalPosition = horizontalIndex * tileWidth;
  var sourceImageVerticalPosition = verticalIndex * tileHeight;

  tileAtIndex.blit(image, 
      tileTargetHorizontalPosition, 
      tileTargetVerticalPosition, 
      sourceImageHorizontalPosition, 
      sourceImageVerticalPosition, 
      tileWidth,
      tileHeight);
  tilesetImages[tileAtIndex.hash()] = tileAtIndex;
}
*/

/*
Jimp.read(inputBitmapFileName).then(function (image) {
  console.log('image loaded, copying....');
  var outputImage = new Jimp(300, 300);
  return outputImage.blit(image, 0, 0, 0, 0, 300, 300);
}).then(function (outputImage) {
  console.log(' this should be called with what I returned before ');
  outputImage.write(outputTileMapFileName);
}).catch(function (err) {
  console.log('couldnt load image ' + err.message);
});
*/

module.exports = {
  getTileTopLeftCoordinates: getTileTopLeftCoordinates,
  tilesetFromImage : tilesetFromImage,
};
