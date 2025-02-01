specification = p:protocol tail:(otherProtocol)* _?
{ return tail.concat([p]) }

otherProtocol = _ p:protocol
{ return p }

protocol = "protocol"? _ pn:protocolName _ "{" _ rs:roles _ ps:parameters _ pps:private? _ refs:references _ "}"
{ return { type: "protocol", name: pn, roles: rs, parameters: ps, private: pps, references: refs } }

protocolName = w:word
{ return { symbol: w, location: location() } }

roles = "roles" _ rl:roleList
{ return rl }

roleList = r:role tail:(otherRole)*
{ return tail.concat([r]) }

role = w:word
{ return { type: "role", name: { symbol: w, location: location() } } }

otherRole = _ "," _ r:role
{ return r }

parameters = "parameters" _ pl:parameterList
{ return pl }

parameterList = p:parameter tail:(otherParameter)*
{ return tail.concat([p]) }

otherParameter = _ "," _ p:parameter
{ return p }

parameter = a:adornment? _ pn:parameterName _ k:"key"?
{ return { type: "parameter", name: pn, adornment: a, key: Boolean(k) } }

adornment = "out" / "in" / "nil" / "any" / "opt"

parameterName = w:word
{ return { symbol: w, location: location() } }

private = "private" _ pl:parameterList
{ return pl }

references = r:reference tail:(otherReference)*
{ return tail.concat([r]) }

otherReference = _ r:reference
{ return r }

reference = message / ref

message = s:role _ ("->" / "→" / "↦") _ r:role _ ":" _ mt:messageType mp:messageParameters?
{ return { type: "message", sender: s, recipient: r, messageType: mt, parameters: mp } }

messageType = w:word
{ return { symbol: w, location: location() } }

messageParameters = "[" _ pl:parameterList _ "]"
{ return pl }

ref = pn:protocolName "(" _ rl:roleList _ "|" _ pl:parameterList _ ")"
{ return { type: "protocolReference", name: pn, roles: rl, parameters: pl } }

word "word" = word:[a-zA-Z0-9@>-]+
{ return word.join('') }

_ "whitespace" = [ \t\n\r]*