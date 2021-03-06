/**
 * @author kazuya kawaguchi (a.k.a. kazupon)
 */
'use strict'

const { extname } = require('path')
const parse5 = require('parse5')
const {
  UNEXPECTED_ERROR_LOCATION,
  getLocaleMessages,
  extractJsonInfo,
  generateJsonAst
} = require('../utils/index')
const debug = require('debug')('eslint-plugin-vue-i18n:no-html-messages')

function traverseNode (node, fn) {
  if (node.type === 'Object' && node.children.length > 0) {
    node.children.forEach(child => {
      if (child.type === 'Property') {
        const keyNode = child.key
        const valueNode = child.value
        if (keyNode.type === 'Identifier' && valueNode.type === 'Object') {
          return traverseNode(valueNode, fn)
        } else {
          return fn(valueNode)
        }
      }
    })
  }
}

function findHTMLNode (node) {
  return node.childNodes.find(child => {
    if (child.nodeName !== '#text' && child.tagName) {
      return true
    }
  })
}

function create (context) {
  const filename = context.getFilename()
  if (extname(filename) !== '.json') {
    debug(`ignore ${filename} in no-html-messages`)
    return {}
  }

  const { settings } = context
  if (!settings['vue-i18n'] || !settings['vue-i18n'].localeDir) {
    context.report({
      loc: UNEXPECTED_ERROR_LOCATION,
      message: `You need to 'localeDir' at 'settings. See the 'eslint-plugin-vue-i18n documentation`
    })
    return {}
  }

  const localeMessages = getLocaleMessages(settings['vue-i18n'].localeDir)
  const targetLocaleMessage = localeMessages.findExistLocaleMessage(filename)
  if (!targetLocaleMessage) {
    debug(`ignore ${filename} in no-html-messages`)
    return {}
  }

  return {
    Program (node) {
      const [jsonString, jsonFilename] = extractJsonInfo(context, node)
      if (!jsonString || !jsonFilename) { return }

      const ast = generateJsonAst(context, jsonString, jsonFilename)
      if (!ast) { return }

      traverseNode(ast, messageNode => {
        const htmlNode = parse5.parseFragment(messageNode.value, { sourceCodeLocationInfo: true })
        const foundNode = findHTMLNode(htmlNode)
        if (!foundNode) { return }
        context.report({
          message: `used HTML localization message`,
          loc: {
            line: messageNode.loc.start.line,
            column: messageNode.loc.start.column + foundNode.sourceCodeLocation.startOffset
          }
        })
      })
    }
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow use HTML localization messages',
      category: 'Recommended',
      recommended: true
    },
    fixable: null,
    schema: []
  },
  create
}
