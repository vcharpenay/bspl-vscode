const vscode = require('vscode')
const parser = require('./parser.js')

//////////////////////////////////////////////////////////////////////// helpers

function getSpecification(document) {
    txt = removeLineComments(document.getText())
    return parser.parse(txt)
}

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

function buildRange(location) {
    let start = location.start
    let end = location.end

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

////////////////////////////////////////////// VS Code interfaces implementation

/**
 * Semantic Token Provider for BSPL.
 * 
 * See https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide
 */
function STP() {
    this.legend = new vscode.SemanticTokensLegend(
        ['class', 'property', 'parameter', 'struct', 'variable'],
        ['declaration']
    )
}

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
    let spec = getSpecification(document)

    const tokensBuilder = new vscode.SemanticTokensBuilder(this.legend)

    collectTokens(spec, []).forEach(([token, ctx]) => {
        tokensBuilder.push(buildRange(token.location), getTokenType(ctx), [])
        // TODO add 'declaration' modifier depending on context
    })

    return tokensBuilder.build()
}

function checkSyntax(document, diagnostics) {
    try {
        spec = getSpecification(document)
        diagnostics.delete(document.uri)
    } catch (e) {
        let diag = new vscode.Diagnostic(
            buildRange(e.location),
            e.message,
            vscode.DiagnosticSeverity.Error
        )

        diagnostics.set(document.uri, [diag])
    }
}

////////////////////////////////////////////////////////////////////////////////

const stp = new STP()

const diagnostics = vscode.languages.createDiagnosticCollection('bspl')

function activate(context) {
    let disposables = [
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'bspl', scheme: 'file' },
            stp,
            stp.legend
        ),
        diagnostics
    ]

    disposables.forEach(d => context.subscriptions.push(d))

    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'bspl' && document.uri.scheme === 'file') {
            checkSyntax(document, diagnostics)
        }
    });
}

function deactivate() {}

module.exports = { activate, deactivate }