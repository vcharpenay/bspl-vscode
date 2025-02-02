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

    return Object.entries(def)
        .filter(([_, val]) => val)
        .map(([key, val]) => collectTokens(val, ctx.concat([key]))).flat()
}

function getHierarchy(root, ctx) {
    if (ctx.length == 0) return [root]

    let child = root[ctx[0]]
    let head = root instanceof Array ? [] : [root]

    return getHierarchy(child, ctx.slice(1)).concat(head)
}

function isDeclaration(spec, ctx) {
    let h = getHierarchy(spec, ctx)

    let parent = h[1]

    switch (parent.type) {
        case 'protocol': return true
        case 'protocolReference': return false
        case 'role': return h.length == 3
        case 'parameter': return h.length == 3
        case 'message': return true
        default: return false
    }
}

function buildIndex(spec, tokens) {
    let symbolIdx = {}

    tokens.forEach(([t, ctx]) => {
        let s = t.symbol

        if (!symbolIdx[s])
            symbolIdx[s] = { declaration: null, references: [] }

        if (isDeclaration(spec, ctx)) symbolIdx[s].declaration = t
        else symbolIdx[s].references.push(t)
    })

    // TODO sort references by location

    return symbolIdx
}

function buildRange(location) {
    let start = location.start
    let end = location.end

    return new vscode.Range(
        new vscode.Position(start.line - 1, start.column - 1),
        new vscode.Position(end.line - 1, end.column - 1)
    )
}

function getTokenType(spec, ctx) {
    let h = getHierarchy(spec, ctx)

    let parent = h[1]

    switch (parent.type) {
        case 'protocol': return 'class'
        case 'protocolReference': return 'class'
        case 'role': return 'property'
        case 'parameter': return 'parameter'
        case 'message': return 'function'
        default: return 'variable'
    }
}

////////////////////////////////////////////// VS Code interfaces implementation

/**
 * Semantic Token Provider
 * 
 * See https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide
 */
function STP() {
    this.legend = new vscode.SemanticTokensLegend(
        ['class', 'property', 'parameter', 'function', 'variable'],
        ['declaration']
    )
}

/**
 * Parse the BSPL document to identify tokens:
 * - protocol name (~class)
 * - role (~property)
 * - parameter (~parameter)
 * - message type (~function)
 * 
 * @param {*} document 
 * @returns a list of tokens and their index in the document
 */
STP.prototype.provideDocumentSemanticTokens = function(document) {
    let spec = getSpecification(document)

    const tokensBuilder = new vscode.SemanticTokensBuilder(this.legend)

    collectTokens(spec, []).forEach(([t, ctx]) => {
        tokensBuilder.push(buildRange(t.location), getTokenType(spec, ctx), [])
        // TODO add 'declaration' modifier depending on context
    })

    return tokensBuilder.build()
}

/**
 * Definition Provider
 * 
 * See https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-definitions-of-a-symbol
 */
function DP() {}

DP.prototype.provideDefinition = function(document, position, token) {
    // spec = getSpecification(document)

    // TODO

    // return vscode.Location
}

function checkSyntax(document, diagnostics) {
    let diags = []

    try {
        let spec = getSpecification(document)
        let tokens = collectTokens(spec, [])

        let idx = buildIndex(spec, tokens)

        Object.keys(idx).forEach(symbol => {
            if (!idx[symbol].declaration) {
                let firstRef = idx[symbol].references[0]

                let diag = new vscode.Diagnostic(
                    buildRange(firstRef.location),
                    `Symbol ${symbol} is never declared`,
                    vscode.DiagnosticSeverity.Warning
                )

                diags.push(diag)
            }
        })

        // TODO check every in parameter is output somewhere
    } catch (e) {
        let diag = new vscode.Diagnostic(
            buildRange(e.location),
            e.message,
            vscode.DiagnosticSeverity.Error
        )

        diags.push(diag)
    }

    diagnostics.set(document.uri, diags)
}

////////////////////////////////////////////////////////////////////////////////

function activate(context) {
    const selector = { language: 'bspl', scheme: 'file' }

    const stp = new STP()
    const dp = new DP()
    
    const diagnostics = vscode.languages.createDiagnosticCollection('bspl')

    let disposables = [
        vscode.languages.registerDocumentSemanticTokensProvider(
            selector, stp, stp.legend
        ),
        vscode.languages.registerDefinitionProvider(
            selector, dp
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