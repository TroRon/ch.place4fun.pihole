# PiHole Control

This application offers the possibility to control the defined PiHole instances via Homey and to send various functions via the PiHole API.

> Important: This app uses a local api available on your PiHole that is undocumented and unsupported by PiHole. If PiHole decides to remove this api in a future upgrade this app will stop working.

# Capabilities

# Flow cards
Flowcards can be used to build flows in Homey's flow editor.

## Action (then)

*Application*
-------------

To use the application cards select 'PiHole Control' in the 'then' column.

## Actions (then)

#### "Enable all PiHole(s)"
This card starts or stops filtering on the selected PiHole.

#### "Disable all PiHole(s)"
This card stops filtering on all PiHoles defined in the settings.

#### "Enable/Disable PiHole Instance"
This card starts filtering on all PiHoles defined in the settings.

#### "Disable PiHole Instance(x) for (x) Minutes"
This card adds the functionality that a Pihole can be disabled for a limited time.

#### "Disable all PiHoles for (x) Minutes"
This card adds the functionality that all Piholes can be disabled for a limited time.


# Version History

### v1.0.9
- Bugfixes / Optimierungen

### v1.0.8
- Bugfixes / Optimierungen / Aktivieren der Flow Tags

### v1.0.7
- The instances are now also available as device cards

### v1.0.6
- Bugfixes

### v1.0.5
- Bugfixes
- New languages:
    DE / EN / NL / FR / IT / SV / NO / ES / DA / RU / PL

### v1.0.4
- Never hit the Athom store
- New Action Card "Disable PiHole Instance(x) for (x) Minutes" added
- New Action Card "Disable all PiHoles for (x) Minutes" added
- Small Bugfixes

### v1.0.3
- Bugfix release (never hit the Athom store)

### v1.0.2
- Bugfix release (never hit the Athom store)
- Expansion to 4 possible instances
- New Settings Layout

### v1.0.1
- Bugfix release (never hit the Athom store)

### v1.0.0 
- Initial release (never hit the Athom store)