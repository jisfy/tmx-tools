# TmxTools

TmxTools is a set of tools to help you work with Tile Maps. Particularly with
those with a [.tmx](http://docs.mapeditor.org/en/latest/reference/tmx-map-format/) format.

## Turning a bitmap into a Tile Map

One of the most basic functions of the TmxTools is to convert bitmap images to
Tile Maps. The underlying idea is to provide the user with a means to develop a
Tile Map in whatever drawing program of his choice, and then slice and dice
that bitmap and turn it into a Tile Map. As if the user had created the
different Tiles by hand, and then crafted a Tile Map using them.

You can get a better idea of how this works, by looking at the examples folder
of this project. The simple folder under this directory contains a source image
that would act as the input to the TmxTools, and a generated .tmx file.

![An input bitmap](https://github.com/jisfy/tmx-tools/blob/master/examples/simple/test.png)
_a sample input bitmap_

![An output Tile Set](https://github.com/jisfy/tmx-tools/blob/master/examples/simple/test-Tileset.png)
_and its corresponding Tile Set_
