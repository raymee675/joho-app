import { Fragment } from 'react';
export default function FormattedText({ text }: { text: string }) {
 return <span className="formatted">{text.split(/([\^_]\{[^}]+\}|[\^_][a-zA-Z0-9])/g).map((s,i) => {
 if (!/^[\^_](\{[^}]+\}|[a-zA-Z0-9])$/.test(s)) return <Fragment key={i}>{s}</Fragment>;
 const value = s[1] === '{' ? s.slice(2,-1) : s.slice(1);
 return s[0] === '^' ? <sup key={i}>{value}</sup> : <sub key={i}>{value}</sub>;
 })}</span>;
}
