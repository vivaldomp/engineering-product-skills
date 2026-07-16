# OpenUI Lang Authoring Guide

UI mockups are authored in **OpenUI Lang** (token-efficient) and rendered to
self-contained HTML by `scripts/openui-render.js`.

## Grammar
- One statement per line: `identifier = Expression`
- The first statement (or an `id` literally named `root`) is the tree root.
- A component is `Type(arg1, arg2, ...)`; arguments map to props by position.
- Values: `"string"`, numbers, `true`/`false`/`null`, arrays `[a, b]`,
  objects `{k: v}`, and references to other identifiers.
- Lines starting with `#` are comments.

## Supported components (positional args)
| Type | Args | Renders |
| --- | --- | --- |
| `Root` | (children[]) | page container |
| `Section` | (children[]) | card-like section |
| `Grid` | (children[]) | responsive grid |
| `Card` | (...children) | a card |
| `Navbar` | (brand, links[]) | top nav |
| `Link` | (label, href) | anchor |
| `StatCard` | (label, value, trend) | KPI tile |
| `Heading` | (text) | h2 |
| `Text` | (text) | paragraph |
| `Button` | (label) | button |
| `Input` | (label, placeholder) | labeled input |
| `Form` | (children[]) | form |

## Example
```text
root = Root([nav, dash])
nav  = Navbar("Acme", [home, settings])
home = Link("Home", "/")
settings = Link("Settings", "/settings")
dash = Section([kpis])
kpis = Grid([rev, users])
rev  = StatCard("Revenue", "$1.2M", "up")
users = StatCard("Users", "450k", "flat")
```

## Render
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/openui-render.js" workspace/outputs/current/ux/home.openui workspace/outputs/current/ux/home.html
```
