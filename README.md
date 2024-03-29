## Usage

```Typescript
import { Gaia, Paint,RectProperty,TextProperty,ImageProperty,PathProperty, LineCapType } from '@raina/gaia';

// ask maxinyue to get latest json
import spriteInfo from "@/assets/sprite_mix.json";

const paint: Paint = Gaia.init('#main-canvas') as Paint;

paint.loadImage(spriteInfo).then(() => {
    paint.drawRect(property:RectProperty);
    paint.drawText(property:TextProperty);
    paint.drawImage(property:ImageProperty);
    paint.drawPath(property:PathProperty);
})


```
