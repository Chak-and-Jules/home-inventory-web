const fs = require('fs')

let content = fs.readFileSync('src/app/item-definitions/page.tsx', 'utf8')
if (content.includes('import { useSignedUrls } from \'@/hooks/useSignedUrls\'')) {
  console.log("Looks good")
}
