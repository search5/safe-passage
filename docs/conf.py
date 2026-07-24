# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'SafePassage'
copyright = '2026, Ji-ho Lee'
author = 'Ji-ho Lee'

version = '0.1.7'
release = '0.1.7'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = []

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# -- Internationalization -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/advanced/intl.html

language = 'en'
locale_dirs = ['locale/']
gettext_compact = False
gettext_uuid = True

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_book_theme'
html_static_path = ['_static']
html_js_files = ['custom.js']
html_title = f'{project} Documentation (EN)'

html_theme_options = {
    'repository_url': 'https://github.com/search5/safe-passage',
    'use_repository_button': True,
    'use_issues_button': True,
    'use_edit_page_button': False,
    'path_to_docs': 'docs',
    'navbar_end': ['version-switcher', 'theme-switcher', 'navbar-icon-links'],
    # NOTE: 'version_match' is pre-declared here as a placeholder so that the
    # config-inited hook below can safely assign to
    # html_theme_options['switcher']['version_match'] without a KeyError.
    'switcher': {
        'json_url': '_static/switcher.json',
        'version_match': 'en',
    },
}

# -- Dynamic per-language HTML tab title --------------------------------------
# Sphinx does not automatically localize html_title when the build language
# is switched via `-D language=ko`, so this hook sets it explicitly for each
# language once the configuration has been read.

def setup(app):
    def update_language_titles(app, config):
        app.config.html_theme_options['switcher']['version_match'] = config.language
        if config.language == 'ko':
            app.config.html_title = f'{project} 문서 (한국어)'
        else:
            app.config.html_title = f'{project} Documentation (EN)'
    app.connect('config-inited', update_language_titles)
