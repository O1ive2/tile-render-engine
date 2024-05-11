## Usage

```Typescript
import { Gaia, Paint,RectProperty,TextProperty,ImageProperty,PathProperty, LineCapType } from '@raina/gaia';

// ask maxinyue to get latest json
import spriteInfo from "@/assets/sprite_mix.json";

const paint: Paint = Gaia.init('#main-canvas') as Paint;

// load sprite data
paint.loadImage(spriteInfo).then(() => {

    Gaia.init({
      workers: 8,
      sprite: spriteInfo
    }).then((gaia: Gaia) => {
      const paint = gaia.createPaint("#main-canvas");

      // blank callback
      paint.onBlank("click",()=>{});
      paint.onBlank("rclick",()=>{});
      paint.onBlank("dbclick",()=>{});


      // draw geometry
      paint.drawRect(property:RectProperty);
      paint.drawText(property:TextProperty);
      paint.drawImage(property:ImageProperty);
      paint.drawPath(property:PathProperty);

      // zoom
      paint.zoom(scale);

      // resize
      paint.resize();

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



      setTimeout(()=>{
        paint.clear();

        // 绘制你的新图形
        ...

        paint.flush(false); // 设置为false保留画布缩放位移信息
      },2000)




    });


```

## bugs left

1. tool bar function extensions
2. line highlight bold not right lineDash
3. highlight shadow left
4. destroy callback
