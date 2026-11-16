import { Fragment, type ReactNode } from "react";

/** Fill {name} placeholders with React elements, e.g. a link inside a translated sentence.
 *  Translators can move the placeholder anywhere in the string; unknown names stay as text.
**/
export function rich(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const name = part.match(/^\{(\w+)\}$/)?.[1];
    return <Fragment key={index}>{name && name in slots ? slots[name] : part}</Fragment>;
  });
}
