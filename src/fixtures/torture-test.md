# Torture Test Document

This file exists to exercise every required markdown feature in one pass, plus a handful of edge cases that tend to break naive renderers.

## Text formatting

Plain paragraph text. **Bold text**, *italic text*, ***bold italic***, ~~strikethrough~~, and `inline code` all in one sentence. A [hyperlink to Anthropic](https://www.anthropic.com) and a bare autolink <https://example.com>.

## Lists

### Unordered

- First item
- Second item
  - Nested item one
  - Nested item two
    - Triple-nested item
- Third item

### Ordered

1. Step one
2. Step two
   1. Sub-step A
   2. Sub-step B
3. Step three

### Mixed nesting

1. Ordered parent
   - Unordered child
   - Another child
2. Second ordered item

### Task list

- [x] Done task
- [ ] Not done task

## Blockquotes

> A simple blockquote.
>
> > A nested blockquote inside it.

## Code

Inline: `const x = 1;`

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}
```

```
Unlabeled fenced block, no language.
```

## Tables

| Left | Center | Right |
|:-----|:------:|------:|
| a    | b      | c     |
| longer cell | x | 1 |

## Edge cases

An unclosed **bold marker that never closes

A [link with no closing paren](https://example.com

| broken | table
| missing | cells |
| a |

```
Unclosed code fence starts here and never ends
## This looks like a heading but is inside the fence

- Empty list item below
-

Trailing line with no newline at end of file
