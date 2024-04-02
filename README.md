## Usage

```Typescript
import { Gaia, Paint,RectProperty,TextProperty,ImageProperty,PathProperty, LineCapType } from '@raina/gaia';

// ask maxinyue to get latest json
import spriteInfo from "@/assets/sprite_mix.json";

const paint: Paint = Gaia.init('#main-canvas') as Paint;

// load sprite data
paint.loadImage(spriteInfo).then(() => {

    // draw geometry
    paint.drawRect(property:RectProperty);
    paint.drawText(property:TextProperty);
    paint.drawImage(property:ImageProperty);
    paint.drawPath(property:PathProperty);

    // use flush to complete
    paint.flush().then(() => {
      // do sth
    });


    // highlight geometry


    // example

    // path
    paint.highlight([`${fromX}-${fromY}-${toX}-${toY}`], {
        strokeStyle: "#5cdbd3",
        lineDash: [4, 4],
    })

    // image
    paint.highlight([handle_name], {
        state: "hover"
    })


    // to recover highlight just set null
    paint.highlight([handle_name], null)







    // full example

    paint.loadImage(spriteInfo).then(() => {
      const checkList: string[] = [];

      for (const { x, y, name, width, height, type, handle_name } of schematicInfo.instanceList) {

        if (type === 'common') {
          continue;
        }

        paint.drawImage({
          id: handle_name,
          imageId: type,
          x,
          y,
          hover: () => {
            if (!checkList.includes(handle_name)) {
              paint.highlight([handle_name], {
                state: "hover"
              })
            }
          },
          hoverOut: () => {
            if (!checkList.includes(handle_name)) {
              paint.highlight([handle_name], null)
            }
          },
          click: () => {
            checkList.push(handle_name);
            paint.highlight([handle_name], {
              state: "check"
            })
          }
        });

        paint.drawText({
          x: x + width / 2 - 1,
          y: y + height / 2,
          content: name,
          fontSize: 3.8,
          fillStyle: "#fff"
        })
      }

      for (const { fromX, fromY, toX, toY } of schematicInfo.lines) {
        paint.drawPath({
          id: `${fromX}-${fromY}-${toX}-${toY}`,
          fromX,
          fromY,
          toX,
          toY,
          strokeStyle: "#D9F7BE",
          lineCap: LineCapType.square,
          lineWidth: 8,
          keepWidth: 1,
          hover: () => {
            if (!checkList.includes(`${fromX}-${fromY}-${toX}-${toY}`)) {
              paint.highlight([`${fromX}-${fromY}-${toX}-${toY}`], {
                strokeStyle: "#5cdbd3",
                lineDash: [4, 4],
              })
            }
          },
          hoverOut: () => {
            if (!checkList.includes(`${fromX}-${fromY}-${toX}-${toY}`)) {
              paint.highlight([`${fromX}-${fromY}-${toX}-${toY}`], null)
            }
          },
          click: () => {
            checkList.push(`${fromX}-${fromY}-${toX}-${toY}`);
            paint.highlight([`${fromX}-${fromY}-${toX}-${toY}`], {
              strokeStyle: "white"
            })
          },
          rclick: () => {
          },
          dbclick: () => {
          }
        })
      }

      paint.flush();
    })


})


```

## bugs

1. single instance -> multi instance (OK)
2. resize fit 
3. tool bar function extensions
4. line highlight bold not right
5. highlight shadow left
6. highlight support lineWidth property
7. flush promise (OK)
