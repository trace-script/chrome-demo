import antfu from '@antfu/eslint-config'
import { createSimplePlugin } from 'eslint-factory'

const tailwindVariableFormatter = createSimplePlugin({
  name: 'tailwind-variable',
  description: 'Format Tailwind CSS variable utilities using the v4 shorthand syntax',
  include: ['**/*.{js,jsx,ts,tsx,vue,html}'],
  create(context) {
    return {
      Program() {
        const pattern = /([\w/-]+)-\[var\((--[\w-]+)\)\]/g

        for (const match of context.text.matchAll(pattern)) {
          const start = match.index
          if (start === undefined)
            continue

          context.replaceTextRange(
            start,
            start + match[0].length,
            `${match[1]}-(${match[2]})`,
          )
        }
      },
    }
  },
})

export default antfu({}, tailwindVariableFormatter)
