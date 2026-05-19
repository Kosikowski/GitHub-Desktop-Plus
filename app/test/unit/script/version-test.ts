import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  getNextPlusVersion,
  getNextVersionNumber,
} from '../../../../script/draft-release/version'

describe('getNextVersionNumber', () => {
  describe('production', () => {
    const channel = 'production'

    it('increments the patch number', () => {
      assert.equal(getNextVersionNumber('1.0.1', channel), '1.0.2')
    })

    describe("doesn't care for", () => {
      it('beta versions', () => {
        assert.throws(
          () => getNextVersionNumber('1.0.1-beta1', channel),
          /Unable to draft production release using beta version '1\.0\.1-beta1'/
        )
      })
      it('test versions', () => {
        assert.throws(
          () => getNextVersionNumber('1.0.1-test42', channel),
          /Unable to draft production release using test version '1\.0\.1-test42'/
        )
      })
    })
  })

  describe('beta', () => {
    const channel = 'beta'

    describe('when a beta version is used', () => {
      it('the beta tag is incremented', () => {
        assert.equal(
          getNextVersionNumber('1.1.2-beta3', channel),
          '1.1.2-beta4'
        )
      })
      it('handles multiple digits', () => {
        assert.equal(
          getNextVersionNumber('1.1.2-beta99', channel),
          '1.1.2-beta100'
        )
      })
    })

    describe('when a production version is used', () => {
      it('increments the patch and returns the first beta', () => {
        assert.equal(getNextVersionNumber('1.0.1', channel), '1.0.2-beta1')
      })
    })

    describe("doesn't care for", () => {
      it('test versions', () => {
        assert.throws(
          () => getNextVersionNumber('1.0.1-test1', channel),
          /Unable to draft beta release using test version '1\.0\.1-test1'/
        )
      })
    })
  })

  describe('plus', () => {
    const channel = 'plus'

    describe('when a plus version is used', () => {
      it('the plus tag is incremented', () => {
        assert.equal(
          getNextVersionNumber('1.1.2-plus.3', channel),
          '1.1.2-plus.4'
        )
      })
      it('handles multiple digits', () => {
        assert.equal(
          getNextVersionNumber('1.1.2-plus.99', channel),
          '1.1.2-plus.100'
        )
      })
    })

    describe('when a production version is used', () => {
      it('increments the patch and returns the first plus', () => {
        assert.equal(getNextVersionNumber('1.0.1', channel), '1.0.2-plus.1')
      })
    })

    describe("doesn't care for", () => {
      it('beta versions', () => {
        assert.throws(
          () => getNextVersionNumber('1.0.1-beta1', channel),
          /Unable to draft plus release using beta version '1\.0\.1-beta1'/
        )
      })
      it('test versions', () => {
        assert.throws(
          () => getNextVersionNumber('1.0.1-test1', channel),
          /Unable to draft plus release using test version '1\.0\.1-test1'/
        )
      })
    })
  })
})

describe('getNextPlusVersion', () => {
  it('starts at -plus.1 when there is no previous plus tag', () => {
    assert.equal(getNextPlusVersion(null, '3.5.8'), '3.5.8-plus.1')
  })

  it('increments N when the previous plus matches upstream stable', () => {
    assert.equal(getNextPlusVersion('3.5.8-plus.2', '3.5.8'), '3.5.8-plus.3')
  })

  it('resets to -plus.1 when upstream advances past the previous plus base', () => {
    assert.equal(getNextPlusVersion('3.5.7-plus.4', '3.5.8'), '3.5.8-plus.1')
  })

  it('refuses when the previous plus is anchored ahead of upstream stable', () => {
    assert.throws(
      () => getNextPlusVersion('3.5.9-plus.1', '3.5.8'),
      /anchored on 3\.5\.9.*ahead of the latest upstream stable 3\.5\.8/
    )
  })

  it('rejects an upstream stable that is itself a prerelease', () => {
    assert.throws(
      () => getNextPlusVersion(null, '3.5.9-beta1'),
      /must not be a prerelease/
    )
  })

  it('rejects a previous version that is not a plus tag', () => {
    assert.throws(
      () => getNextPlusVersion('3.5.8-beta1', '3.5.8'),
      /not a plus release tag/
    )
  })

  it('handles multi-digit plus numbers', () => {
    assert.equal(getNextPlusVersion('3.5.8-plus.99', '3.5.8'), '3.5.8-plus.100')
  })
})
