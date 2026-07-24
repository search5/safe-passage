Installation
============

There are two ways to install **SafePassage**.

Method 1 — Install from Obsidian's Community Plugins browser
---------------------------------------------------------------

This is the recommended method for most users.

#. Open Obsidian and go to **Settings → Community plugins**.
#. Make sure **Restricted mode** is turned off.
#. Click **Browse** and search for ``SafePassage``.
#. Click **Install**, then **Enable** the plugin once installation finishes.

Method 2 — Clone the Git repository and build from source
--------------------------------------------------------------

Use this method if you want to build the plugin yourself, run a development
build, or contribute changes.

**Requirements:** `Node.js <https://nodejs.org/>`_ 18 or later.

.. code-block:: bash

   git clone https://github.com/search5/safe-passage.git
   cd safe-passage
   npm install
   npm run build

Then copy ``main.js``, ``manifest.json``, and ``styles.css`` into your
vault's plugin directory:

.. code-block:: bash

   <your-vault>/.obsidian/plugins/safe-passage/

Restart Obsidian, then enable **SafePassage** under
**Settings → Community plugins**.

Once installed, continue to :doc:`usage` to configure a database profile.
