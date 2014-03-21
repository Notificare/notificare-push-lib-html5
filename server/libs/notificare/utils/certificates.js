/**
 * @fileoverview Utils for Notificare
 * @author Joris Verbogt <joris@notifica.re>
 * @version 1.0
 */

var debug = require('debug')('notificare:utils'),
	openssl = require('openssl-wrapper');


/**
 * Parse an X.509 certificate
 * @param {String|Buffer} certificate in PEM format
 * @param {Function} callback
 */
function parseCertificate(certificate, done) {
	openssl.exec('x509', certificate, {
		noout: true, 
		issuer: true, 
		subject: true, 
		serial: true, 
		dates: true
	}, function(err, info) {
		if (!info || info.length == 0) {
			done(err);
		} else {
			try {
				var infoParts = {};
				var infoLines = info.toString().split('\n');
				infoLines.forEach(function(infoLine) {
					var separator = infoLine.indexOf('=');
					infoParts[infoLine.substring(0, separator)] = infoLine.substring(separator + 1).trim();
				});
				var result = {};
				if (!infoParts.serial || !infoParts.subject || !infoParts.issuer || !infoParts.notBefore || !infoParts.notAfter) {
					done(new Error('not a valid X.509 certificate'));
				} else {
					result.serial = infoParts.serial;
					result.subject = parseAddress(infoParts.subject);
					result.issuer = parseAddress(infoParts.issuer);
					result.notBefore = new Date(infoParts.notBefore);
					result.notAfter = new Date(infoParts.notAfter);
					done(null, result);
				}
			} catch (e) {
				done(e);
			}
		}
	});
}

/**
 * Verify that a certificate and a private key match
 * @param certificate
 * @param key
 * @param done
 */
function verify(certificate, key, done) {
	openssl.exec('x509', certificate, {
		noout: true,
		pubkey: true
	}, function(err, pubKey1) {
		if (!pubKey1 || pubKey1.length == 0) {
			done(new Error('error reading certificate'));
		} else {
			openssl.exec('rsa', key, {
				pubout: true
			}, function(err, pubKey2) {
				if (!pubKey2 || pubKey2.length == 0) {
					done(new Error('error reading key'));
				} else {
					if (pubKey1.toString() != pubKey2.toString()) {
						done(new Error('certificate and key do not match'));
					} else {
						done();
					}
				}
			});			
		}
	});
}

/**
 * Parse an X.500 address
 * @param {String} the X.500 address
 * @returns {Object} the parsed address
 */
function parseAddress(address) {
	var result = {};
	var cleanAddress = address.substring(address.indexOf('/') + 1);
	var addressParts = cleanAddress.split('/');
	addressParts.forEach(function(addressPart) {
		var splitPart = addressPart.split('=');
		result[splitPart[0]] = splitPart[1];
	});
	return result;
}



function parsePKCS12(pkcs, password, done) {
	openssl.exec('pkcs12', pkcs, {
		nodes: true, 
		passin: 'pass:' + password
	}, function(err, pem) {
		if (!pem || pem.length == 0) {
			done(new Error('failed to open the PKCS12 archive'));
		} else {
			openssl.exec('rsa', pem, {}, function(err, key) {
				if (!key || key.length == 0) {
					done(new Error('failed to extract private key from PKCS12 archive'));
				} else {
					openssl.exec('x509', pem, {}, function(err, cert) {
						if (!cert || cert.length == 0) {
							done(new Error('failed to extract certificate from PKCS12 archive'));
						} else {
							verify(cert, key, function(err) {
								if (err) {
									done(err);
								} else {
									parseCertificate(cert, function(err, info) {
										if (err) {
											done(new Error('error parsing PKCS12 archive: ' + err.message));
										} else {
											var now = new Date();
											if (info.notBefore > now || info.notAfter < now) {
												done(new Error('certificate is not valid'));
											} else if (info.subject.CN.indexOf('Apple Production IOS Push Services') !== 0 && info.subject.CN.indexOf('Apple Development IOS Push Services') !== 0) {
												done(new Error('certificate is not an APNS certificate'));
											} else {
												done(null, key.toString(), cert.toString(), info);														
											}
										}
									});
								}
							});
						}
					});
				}
			});
		}
	});
}

module.exports = {
	verify: verify,
	parsePKCS12: parsePKCS12,
	parseCertificate: parseCertificate,
	parseAddress: parseAddress
};