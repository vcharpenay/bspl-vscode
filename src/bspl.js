const vscode = require('vscode')
const parser = require('./parser.js')

const tokenTypes = ['class', 'property', 'parameter', 'struct', 'variable'];
const tokenModifiers = ['declaration'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

function removeLineComments(txt) {
    return txt.replaceAll(/\/\/.*(\r?\n)/g, '$1')
}

function collectTokens(def, ctx) {
    if (def.location) return [[def, ctx]]
    if (!(def.type || (def instanceof Array))) return []

    if (def.type) ctx = ctx.concat(def.type)

    return Object.values(def)
        .filter(val => val)
        .map(val => collectTokens(val, ctx)).flat()
}

function buildRange(token) {
    let start = token.location.start
    let end = token.location.end

    return new vscode.Range(
        new vscode.Position(start.line - 1, start.column - 1),
        new vscode.Position(end.line - 1, end.column - 1)
    )
}

function getTokenType(ctx) {
    let last = ctx[ctx.length - 1]

    switch (last) {
        case 'protocol': return 'class'
        case 'protocolReference': return 'class'
        case 'role': return 'property'
        case 'parameter': return 'parameter'
        case 'message': return 'struct'
        default: return 'variable'
    }
}

/**
 * Semantic Token Provider for BSPL.
 * 
 * See https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide
 */
const STP = function() {}

/**
 * Parse the BSPL document to identify tokens:
 * - protocol name (~class)
 * - role (~property)
 * - parameter (~parameter)
 * - message type (~struct)
 * 
 * @param {*} document 
 * @returns a list of tokens and their index in the document
 */
STP.prototype.provideDocumentSemanticTokens = function(document) {
    txt = removeLineComments(document.getText())
    spec = parser.parse(txt)

    const tokensBuilder = new vscode.SemanticTokensBuilder(legend)

    collectTokens(spec, []).forEach(([token, ctx]) => {
        tokensBuilder.push(buildRange(token), getTokenType(ctx), [])
        // TODO add 'declaration' modifier depending on context
    })

    return tokensBuilder.build()
}

function activate(context) {
	let d = vscode.languages.registerDocumentSemanticTokensProvider(
        { language: 'bspl', scheme: 'file' },
        new STP(),
        legend
    )

	context.subscriptions.push(d)
}

function deactivate() {}

module.exports = { activate, deactivate }